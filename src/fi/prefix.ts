import type { ResolvedCalendar } from "../calendar/business"
import { collectDates } from "../engine/dates"
import { type DatedEvent, flowsAt } from "../engine/events"
import { settlementPeriods } from "../engine/levy-plan"
import { createTracker, hasSettlement } from "../engine/levy-tally"
import type { LevyTracker } from "../engine/levy-types"
import { type EngineRunsOut, processDate } from "../engine/occurrence"
import { isSafeInteger, overflow } from "../engine/overflow"
import { createStates, type StateMap } from "../engine/state"
import type { Baseline, DateString, Scenario, Timeline } from "../types"
import type { ProjectionProblem } from "../types/projection"
import { cloneStates, cloneTracker } from "./clone"

export interface PrefixPoint {
	readonly states: StateMap
	readonly tracker: LevyTracker | undefined
}

export interface Prefix {
	readonly points: ReadonlyMap<DateString, PrefixPoint>
	readonly runsOut: EngineRunsOut | undefined
	readonly problem?: ProjectionProblem
	readonly stoppedAt?: DateString
}

export interface LevyPlan {
	readonly tracker: LevyTracker | undefined
	readonly settlementDates: readonly DateString[]
}

/** The Levy tracker and settled dates for a timeline, sharing `runEngine`'s period plan. */
export function levyPlan(
	scenario: Scenario,
	timeline: Timeline,
	calendar: ResolvedCalendar | undefined,
): LevyPlan {
	if (scenario.levy === undefined) return { tracker: undefined, settlementDates: [] }
	const periods = settlementPeriods(timeline.start, timeline.horizon, scenario.levy, calendar)
	return {
		tracker: createTracker(scenario.levy, periods, scenario.economy.inflation, timeline.start),
		settlementDates: periods
			.map((period) => period.settlementDate)
			.filter((date) => date <= timeline.horizon),
	}
}

interface PrefixAdvance {
	readonly problem?: ProjectionProblem
	readonly runsOut?: EngineRunsOut
}

function advance(
	states: StateMap,
	scenario: Scenario,
	date: DateString,
	dayEvents: readonly DatedEvent[],
	tracker: LevyTracker | undefined,
): PrefixAdvance {
	if (dayEvents.length === 0 && !(tracker !== undefined && hasSettlement(tracker, date))) {
		return {}
	}
	const outcome = processDate(states, scenario, date, dayEvents, tracker)
	if (outcome.problem !== undefined) return { problem: outcome.problem }
	if (outcome.runsOut === undefined) return {}
	if (!isSafeInteger(outcome.runsOut.unmet)) return { problem: overflow(date) }
	return { runsOut: outcome.runsOut }
}

/** Walks the unmodified Scenario once, saving states and Levy tallies before each candidate month. */
export function baselinePrefix(
	baseline: Baseline,
	scenario: Scenario,
	timeline: Timeline,
	events: readonly DatedEvent[],
	candidates: readonly DateString[],
	calendar: ResolvedCalendar | undefined,
): Prefix {
	const states = createStates(baseline, scenario, timeline.start)
	const plan = levyPlan(scenario, timeline, calendar)
	const tracker = plan.tracker
	const wanted = new Set(candidates)
	const points = new Map<DateString, PrefixPoint>()
	const dates = collectDates(events, candidates, plan.settlementDates)
	let index = 0
	for (const date of dates) {
		if (wanted.has(date)) {
			points.set(date, { states: cloneStates(states), tracker: cloneTracker(tracker) })
		}
		const [next, dayEvents] = flowsAt(events, index, date)
		index = next
		const stepped = advance(states, scenario, date, dayEvents, tracker)
		if (stepped.problem !== undefined) {
			return { points, runsOut: undefined, problem: stepped.problem, stoppedAt: date }
		}
		if (stepped.runsOut !== undefined) {
			return { points, runsOut: stepped.runsOut, stoppedAt: date }
		}
	}
	return { points, runsOut: undefined }
}
