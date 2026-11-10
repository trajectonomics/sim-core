import type { AccountId, DateString, Scenario } from "../types"
import type { ProjectionProblem } from "../types/projection"
import { aggregate } from "./aggregate"
import { applyAssets, applyDebt } from "./contributions"
import type { DatedEvent } from "./events"
import { mergeFunded, settlementOn, tally, totalsOf } from "./levy-step"
import type { LevyTracker } from "./levy-types"
import { route } from "./route"
import type { StateMap } from "./state"

export interface DayTotals {
	readonly date: DateString
	/** Planned gross income before Prepayment. */
	readonly income: bigint
	readonly expense: bigint
	readonly contributions: bigint
	readonly unfunded: ReadonlyMap<AccountId, bigint>
	/** Prepayment plus Settlements net of refunds on this date. */
	readonly levy: bigint
}

export interface EngineRunsOut {
	readonly date: DateString
	readonly unmet: bigint
}

export interface DateOutcome {
	readonly totals: DayTotals
	readonly problem: ProjectionProblem | undefined
	readonly runsOut: EngineRunsOut | undefined
}

/** Applies one occurrence date in the canonical order of operations. */
export function processDate(
	states: StateMap,
	scenario: Scenario,
	date: DateString,
	events: readonly DatedEvent[],
	tracker: LevyTracker | undefined,
): DateOutcome {
	const day = aggregate(events, scenario.economy.inflation, date, tracker)
	const settlement = settlementOn(tracker, date)
	if (day.capProblem !== undefined) {
		const totals = totalsOf(date, day, 0n, new Map(), settlement)
		return { totals, problem: day.capProblem, runsOut: undefined }
	}
	const debt = applyDebt(states, day.contributionEntries, date)
	if (debt.problem !== undefined) {
		tally(tracker, date, day.gross, debt.funded, day.prepaid)
		const totals = totalsOf(date, day, debt.paid, new Map(), settlement)
		return { totals, problem: debt.problem, runsOut: undefined }
	}
	const cashflow = day.income - day.prepaid - day.expense - debt.paid - settlement.amount
	const available = cashflow > 0n ? cashflow : 0n
	const assets = applyAssets(
		states,
		scenario.cashflow.contribute,
		day.contributionEntries,
		available,
		date,
	)
	tally(tracker, date, day.gross, mergeFunded(debt.funded, assets.funded), day.prepaid)
	const totals = totalsOf(date, day, debt.paid + assets.applied, assets.unfunded, settlement)
	if (settlement.problem !== undefined)
		return { totals, problem: settlement.problem, runsOut: undefined }
	if (assets.problem !== undefined) return { totals, problem: assets.problem, runsOut: undefined }
	return route(states, scenario, date, totals, cashflow - assets.applied)
}
