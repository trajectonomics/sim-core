import type { DateString, IncomeFlow } from "../types"
import type { ProjectionProblem } from "../types/projection"
import { addTo } from "./add"
import {
	eligible,
	plainShares,
	type SettlementPeriodView,
	settlementPeriodGross,
	share,
} from "./levy-shares"
import { isSafeInteger, overflow } from "./overflow"

export interface IncomeShare {
	readonly prepaid: bigint
	readonly byLevy: ReadonlyMap<string, bigint>
	readonly problem?: ProjectionProblem
}

interface CappedShare {
	readonly levy: string | undefined
	readonly taken: bigint
	readonly problem: ProjectionProblem | undefined
}

/** The share on the part of an Occurrence below the Flow's `upTo` cap, for its own Levy. */
function cappedShare(
	flow: IncomeFlow,
	amount: bigint,
	gross: ReadonlyMap<string, bigint>,
	views: readonly SettlementPeriodView[],
	date: DateString,
): CappedShare {
	const capped = flow.cappedPrepayment
	const label = flow.label
	if (capped === undefined || label === undefined)
		return { levy: undefined, taken: 0n, problem: undefined }
	const view = views.find((item) => item.levy === capped.levy)
	const cap = view?.caps?.get(flow.id)
	if (view === undefined || cap === undefined)
		return { levy: capped.levy, taken: 0n, problem: undefined }
	if (!isSafeInteger(cap)) return { levy: capped.levy, taken: 0n, problem: overflow(date) }
	const already = settlementPeriodGross(view, label, gross)
	return {
		levy: capped.levy,
		taken: share(eligible(amount, already, cap), capped.bps),
		problem: undefined,
	}
}

/**
 * Adds one labeled income amount to the gross tallies and returns its Prepayment: the plain
 * shares plus the capped share on the part below the Flow's cap, all per Levy.
 */
export function addIncome(
	flow: IncomeFlow,
	amount: bigint,
	gross: Map<string, bigint>,
	views: readonly SettlementPeriodView[],
	date: DateString,
): IncomeShare {
	const byLevy = new Map(plainShares(flow.prepayments ?? [], amount, views))
	let prepaid = 0n
	for (const amountTaken of byLevy.values()) prepaid += amountTaken
	const capped = cappedShare(flow, amount, gross, views, date)
	if (capped.levy !== undefined && capped.taken !== 0n) {
		byLevy.set(capped.levy, (byLevy.get(capped.levy) ?? 0n) + capped.taken)
		prepaid += capped.taken
	}
	if (flow.label !== undefined) addTo(gross, flow.label, amount)
	if (capped.problem !== undefined) return { prepaid, byLevy, problem: capped.problem }
	return { prepaid, byLevy }
}
