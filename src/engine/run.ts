import type { Baseline, DateString, Scenario, Timeline } from "../types"
import { collectDates } from "./dates"
import { buildEvents, type DatedEvent } from "./events"
import { type SettlementPeriodPlan, settlementPeriods } from "./levy-plan"
import { finishTracker } from "./levy-settle"
import { createTracker } from "./levy-tally"
import type { LevyTracker } from "./levy-types"
import type { EngineResult } from "./result"
import { type RunAccumulator, stepDate } from "./run-step"
import { createStates } from "./state"

interface Plan {
	readonly periods: readonly SettlementPeriodPlan[]
	readonly tracker: LevyTracker | undefined
}

function planFor(scenario: Scenario, timeline: Timeline): Plan {
	if (scenario.levy === undefined) return { periods: [], tracker: undefined }
	const periods = settlementPeriods(timeline.start, timeline.horizon, scenario.levy)
	return {
		periods,
		tracker: createTracker(scenario.levy, periods, scenario.economy.inflation, timeline.start),
	}
}

function settlementDates(
	periods: readonly SettlementPeriodPlan[],
	horizon: DateString,
): DateString[] {
	return periods.map((period) => period.settlementDate).filter((date) => date <= horizon)
}

function eventsFor(
	events: readonly DatedEvent[],
	index: number,
	date: DateString,
): readonly [number, readonly DatedEvent[]] {
	let next = index
	while (next < events.length && events[next]?.date === date) next++
	return [next, events.slice(index, next)]
}

function attachLevy(
	result: EngineResult,
	tracker: LevyTracker | undefined,
	runEnd: DateString,
): EngineResult {
	if (!result.ok || tracker === undefined) return result
	const finished = finishTracker(tracker, runEnd)
	if (!finished.ok) return { ok: false, problem: finished.problem }
	return { ok: true, run: { ...result.run, levy: finished.levy } }
}

function endDate(result: EngineResult, timeline: Timeline): DateString {
	if (!result.ok) return timeline.horizon
	return result.run.runsOut?.date ?? timeline.horizon
}

export function runEngine(
	baseline: Baseline,
	scenario: Scenario,
	timeline: Timeline,
	observations: readonly DateString[],
): EngineResult {
	const states = createStates(baseline, scenario, timeline.start)
	const events = buildEvents(scenario, timeline)
	const { periods, tracker } = planFor(scenario, timeline)
	const acc: RunAccumulator = {
		snapshots: [],
		totals: [],
		wanted: new Set<DateString>(observations),
		levy: tracker,
	}
	let index = 0
	const dates = collectDates(events, observations, settlementDates(periods, timeline.horizon))
	for (const date of dates) {
		const [next, dayEvents] = eventsFor(events, index, date)
		index = next
		const result = stepDate(acc, states, scenario, date, dayEvents)
		if (result !== undefined) return attachLevy(result, tracker, endDate(result, timeline))
	}
	const run = { snapshots: acc.snapshots, totals: acc.totals }
	return attachLevy({ ok: true, run }, tracker, timeline.horizon)
}
