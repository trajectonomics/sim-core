import type { DateString, Scenario } from "../types"
import type { ProjectionProblem } from "../types/projection"
import { aggregate } from "./aggregate"
import { applyContributions } from "./contributions"
import type { DatedEvent } from "./events"
import { settleAt } from "./levy-settle"
import { addFlowTallies, addFundedTallies } from "./levy-tally"
import type { LevyTracker } from "./levy-types"
import type { StateMap } from "./state"
import { applySurplus } from "./surplus"
import { applyWithdraw } from "./withdraw"

export interface DayTotals {
	readonly date: DateString
	/** Planned gross income before Prepayment. */
	readonly income: bigint
	readonly expense: bigint
	readonly contributions: bigint
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

interface Settlement {
	readonly amount: bigint
	readonly problem: ProjectionProblem | undefined
}

function settlementOn(tracker: LevyTracker | undefined, date: DateString): Settlement {
	if (tracker === undefined) return { amount: 0n, problem: undefined }
	const outcome = settleAt(tracker, date)
	return { amount: outcome.settlement, problem: outcome.problem }
}

function tally(
	tracker: LevyTracker | undefined,
	date: DateString,
	gross: ReadonlyMap<string, bigint>,
	funded: ReadonlyMap<string, bigint>,
	prepaid: bigint,
): void {
	if (tracker === undefined) return
	addFlowTallies(tracker, date, gross, prepaid)
	addFundedTallies(tracker, date, funded)
}

function route(
	states: StateMap,
	scenario: Scenario,
	date: DateString,
	totals: DayTotals,
	prepaid: bigint,
	settlement: bigint,
): DateOutcome {
	const net = totals.income - prepaid - totals.expense - totals.contributions - settlement
	if (net > 0n) {
		const problem = applySurplus(states, scenario, date, net)
		return { totals, problem, runsOut: undefined }
	}
	if (net < 0n) {
		const drawn = applyWithdraw(states, scenario, date, -net)
		if (drawn.problem !== undefined) return { totals, problem: drawn.problem, runsOut: undefined }
		if (drawn.remaining > 0n) {
			return { totals, problem: undefined, runsOut: { date, unmet: drawn.remaining } }
		}
	}
	return { totals, problem: undefined, runsOut: undefined }
}

/** Applies one occurrence date in the canonical order of operations. */
export function processDate(
	states: StateMap,
	scenario: Scenario,
	date: DateString,
	events: readonly DatedEvent[],
	tracker: LevyTracker | undefined,
): DateOutcome {
	const day = aggregate(events, scenario.economy.inflation)
	const settlement = settlementOn(tracker, date)
	const applied = applyContributions(states, day.contributionEntries, date)
	tally(tracker, date, day.gross, applied.funded, day.prepaid)
	const totals = {
		date,
		income: day.income,
		expense: day.expense,
		contributions: applied.outflow,
		levy: day.prepaid + settlement.amount,
	}
	if (settlement.problem !== undefined)
		return { totals, problem: settlement.problem, runsOut: undefined }
	if (applied.problem !== undefined) return { totals, problem: applied.problem, runsOut: undefined }
	return route(states, scenario, date, totals, day.prepaid, settlement.amount)
}
