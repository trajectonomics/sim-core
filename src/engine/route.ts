import type { DateString, Scenario } from "../types"
import type { DateOutcome, DayTotals } from "./occurrence"
import type { StateMap } from "./state"
import { applySurplus } from "./surplus"
import { applyWithdraw } from "./withdraw"

/** Routes a positive net to surplus, a negative net to the withdrawal list, or records a Shortfall. */
export function route(
	states: StateMap,
	scenario: Scenario,
	date: DateString,
	totals: DayTotals,
	net: bigint,
): DateOutcome {
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
