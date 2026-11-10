import { roundHalfUp } from "../money/round"
import type { DateString, IncomeFlow } from "../types"
import type { ProjectionProblem } from "../types/projection"
import { addTo } from "./add"
import { settlementPeriodIndexAt } from "./levy-plan"
import type { LevyTally, LevyTracker } from "./levy-types"
import { isSafeInteger, overflow } from "./overflow"

/** The tally and the cap table of the Settlement period one Occurrence date falls in. */
export interface SettlementPeriodView {
	readonly tally: LevyTally | undefined
	readonly caps: ReadonlyMap<string, bigint> | undefined
}

export function settlementPeriodView(
	tracker: LevyTracker | undefined,
	date: DateString,
): SettlementPeriodView {
	if (tracker === undefined) return { tally: undefined, caps: undefined }
	const index = settlementPeriodIndexAt(tracker.periods, date)
	if (index < 0) return { tally: undefined, caps: undefined }
	return { tally: tracker.tallies[index], caps: tracker.caps[index] }
}

/** A rate in basis points of `amount`, rounded half up in minor units. */
function share(amount: bigint, bps: number): bigint {
	return roundHalfUp(amount * BigInt(bps), 10_000n)
}

/** Period-to-date gross of `label` before this event: the tracker's total plus today's earlier ones. */
function settlementPeriodGross(
	view: SettlementPeriodView,
	label: string,
	today: ReadonlyMap<string, bigint>,
): bigint {
	return (view.tally?.gross.get(label) ?? 0n) + (today.get(label) ?? 0n)
}

/** The part of `amount` that lies below `cap` on a period-to-date gross of `already`. */
function eligible(amount: bigint, already: bigint, cap: bigint): bigint {
	const room = cap - already
	if (room <= 0n) return 0n
	return room < amount ? room : amount
}

export interface IncomeShare {
	readonly prepaid: bigint
	readonly problem?: ProjectionProblem
}

/**
 * Adds one labeled income amount to the gross tallies and returns its Prepayment: the plain
 * share on the whole amount plus the capped share on the part below the Flow's cap.
 */
export function addIncome(
	flow: IncomeFlow,
	amount: bigint,
	gross: Map<string, bigint>,
	view: SettlementPeriodView,
	date: DateString,
): IncomeShare {
	let prepaid = flow.prepaymentBps === undefined ? 0n : share(amount, flow.prepaymentBps)
	const capped = flow.cappedPrepayment
	const label = flow.label
	if (capped !== undefined && label !== undefined) {
		const cap = view.caps?.get(flow.id)
		if (cap !== undefined && !isSafeInteger(cap)) return { prepaid, problem: overflow(date) }
		if (cap !== undefined) {
			prepaid += share(eligible(amount, settlementPeriodGross(view, label, gross), cap), capped.bps)
		}
	}
	if (label !== undefined) addTo(gross, label, amount)
	return { prepaid }
}
