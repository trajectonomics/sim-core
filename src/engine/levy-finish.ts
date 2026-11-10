import type { ResolvedCalendar } from "../calendar/business"
import type { DateString, Scenario, Timeline } from "../types"
import type { ProjectionProblem } from "../types/projection"
import { settlementPeriods } from "./levy-plan"
import { hasSettlement, type LevySet } from "./levy-set"
import { finishTracker } from "./levy-settle"
import { createTracker } from "./levy-tally"
import type { EngineLevy } from "./levy-types"
import type { StateMap } from "./state"

export type LeviesFinishOutcome =
	| { readonly ok: true; readonly levies: readonly EngineLevy[] }
	| { readonly ok: false; readonly problem: ProjectionProblem }

/** One tracker per Levy, each with its own periods, Carry-in and cap tables. */
export function planLevies(
	scenario: Scenario,
	timeline: Timeline,
	calendar: ResolvedCalendar | undefined,
): LevySet | undefined {
	const levies = scenario.levies
	if (levies === undefined || levies.length === 0) return undefined
	const trackers = levies.map((levy) => {
		const periods = settlementPeriods(timeline.start, timeline.horizon, levy, calendar)
		return createTracker(levy, scenario.flows, periods, scenario.economy.inflation, timeline.start)
	})
	return { trackers }
}

/** Every Levy's result, in Scenario order; the first failing Levy's problem is reported. */
export function finishLevies(
	set: LevySet,
	states: StateMap,
	runEnd: DateString,
): LeviesFinishOutcome {
	const levies: EngineLevy[] = []
	for (const tracker of set.trackers) {
		const finished = finishTracker(tracker, states, runEnd)
		if (!finished.ok) return { ok: false, problem: finished.problem }
		levies.push(finished.levy)
	}
	return { ok: true, levies }
}

/** True when any Levy has a Settlement on `date`. */
export function settlementFalls(set: LevySet | undefined, date: DateString): boolean {
	return set !== undefined && hasSettlement(set, date)
}
