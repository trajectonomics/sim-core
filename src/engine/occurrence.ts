import type { AccountId, DateString, Scenario } from "../types"
import type { ProjectionProblem } from "../types/projection"
import { aggregate } from "./aggregate"
import { applyAssets, applyDebt } from "./contributions"
import type { DatedEvent } from "./events"
import type { StateMap } from "./state"
import { applySurplus } from "./surplus"
import { applyWithdraw } from "./withdraw"

export interface DayTotals {
	readonly date: DateString
	readonly income: bigint
	readonly expense: bigint
	readonly contributions: bigint
	readonly unfunded: ReadonlyMap<AccountId, bigint>
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
): DateOutcome {
	const day = aggregate(events, scenario.economy.inflation)
	const debt = applyDebt(states, day.contributions, date)
	if (debt.problem !== undefined) {
		const totals = {
			date,
			income: day.income,
			expense: day.expense,
			contributions: debt.paid,
			unfunded: new Map<AccountId, bigint>(),
		}
		return { totals, problem: debt.problem, runsOut: undefined }
	}
	const cashflow = day.income - day.expense - debt.paid
	const available = cashflow > 0n ? cashflow : 0n
	const assets = applyAssets(
		states,
		scenario.cashflow.contribute,
		day.contributions,
		available,
		date,
	)
	const totals = {
		date,
		income: day.income,
		expense: day.expense,
		contributions: debt.paid + assets.applied,
		unfunded: assets.unfunded,
	}
	if (assets.problem !== undefined) return { totals, problem: assets.problem, runsOut: undefined }
	const net = cashflow - assets.applied
	if (net > 0n) {
		const problem = applySurplus(states, scenario, date, net)
		return { totals, problem, runsOut: undefined }
	}
	if (net < 0n) {
		const drawn = applyWithdraw(states, scenario, date, -net)
		if (drawn.problem !== undefined) {
			return { totals, problem: drawn.problem, runsOut: undefined }
		}
		if (drawn.remaining > 0n) {
			return { totals, problem: undefined, runsOut: { date, unmet: drawn.remaining } }
		}
	}
	return { totals, problem: undefined, runsOut: undefined }
}
