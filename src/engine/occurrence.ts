import type { DateString, Scenario } from "../types"
import type { ProjectionProblem } from "../types/projection"
import { aggregate } from "./aggregate"
import { applyAssets, applyDebt } from "./contributions"
import { plannedAmounts } from "./derive"
import type { DatedEvent } from "./events"
import { type LevySet, settlementOn, settlementPeriodViews } from "./levy-set"
import { mergeFunded, tally, totalsOf } from "./levy-step"
import { route } from "./route"
import type { StateMap } from "./state"

export interface DayTotals {
	readonly date: DateString
	/** Planned gross income before Prepayment. */
	readonly income: bigint
	readonly expense: bigint
	readonly contributions: bigint
	readonly unfunded: ReadonlyMap<string, bigint>
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

const nothing = { income: 0n, expense: 0n, prepaid: 0n }

/** A Derived-amount problem is reported before any Settlement, debt or tally work on the date. */
function plannedFail(date: DateString, problem: ProjectionProblem): DateOutcome {
	return {
		totals: totalsOf(date, nothing, 0n, new Map(), { amount: 0n, problem: undefined }),
		problem,
		runsOut: undefined,
	}
}

/** Applies one occurrence date in the canonical order of operations. */
export function processDate(
	states: StateMap,
	scenario: Scenario,
	date: DateString,
	events: readonly DatedEvent[],
	levies: LevySet | undefined,
): DateOutcome {
	const planned = plannedAmounts(events, scenario.flows, date, scenario.economy.inflation)
	if (!planned.ok) return plannedFail(date, planned.problem)
	const views = levies === undefined ? [] : settlementPeriodViews(levies, date)
	const day = aggregate(events, planned.planned, views, date)
	const settlement =
		levies === undefined ? { amount: 0n, problem: undefined } : settlementOn(levies, states, date)
	if (day.problem !== undefined) {
		return {
			totals: totalsOf(date, day, 0n, new Map(), settlement),
			problem: day.problem,
			runsOut: undefined,
		}
	}
	const debt = applyDebt(states, day.contributionEntries, date, levies)
	if (debt.problem !== undefined) {
		tally(levies, date, day.gross, debt.funded, day.prepaidByLevy)
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
		levies,
	)
	tally(levies, date, day.gross, mergeFunded(debt.funded, assets.funded), day.prepaidByLevy)
	const totals = totalsOf(date, day, debt.paid + assets.applied, assets.unfunded, settlement)
	if (settlement.problem !== undefined)
		return { totals, problem: settlement.problem, runsOut: undefined }
	if (assets.problem !== undefined) return { totals, problem: assets.problem, runsOut: undefined }
	return route(states, scenario, date, totals, cashflow - assets.applied, levies)
}
