import { resolvedCalendar } from "../calendar/resolve"
import type { Baseline, DateString, Scenario, Timeline } from "../types"
import { collectDates } from "./dates"
import { buildEvents, flowsAt } from "./events"
import { finishLevies, planLevies } from "./levy-finish"
import { allSettlementDates, type LevySet } from "./levy-set"
import type { EngineResult } from "./result"
import { resolveReturns } from "./return-rows"
import type { Returns } from "./returns"
import { type RunAccumulator, stepDate } from "./run-step"
import { createStates, type StateMap } from "./state"

function attachLevies(
	result: EngineResult,
	states: StateMap,
	levies: LevySet | undefined,
	runEnd: DateString,
): EngineResult {
	if (!result.ok || levies === undefined) return result
	const finished = finishLevies(levies, states, runEnd)
	if (!finished.ok) return { ok: false, problem: finished.problem }
	return { ok: true, run: { ...result.run, levies: finished.levies } }
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
	returns?: Returns,
): EngineResult {
	const states = createStates(baseline, scenario, timeline.start, resolveReturns(returns, timeline))
	const calendar = resolvedCalendar(scenario)
	const events = buildEvents(scenario, timeline, calendar)
	const levies = planLevies(scenario, timeline, calendar)
	const acc: RunAccumulator = {
		snapshots: [],
		totals: [],
		wanted: new Set<DateString>(observations),
		levies,
	}
	let index = 0
	const settlements = levies === undefined ? [] : allSettlementDates(levies, timeline.horizon)
	const dates = collectDates(events, observations, settlements)
	for (const date of dates) {
		const [next, dayEvents] = flowsAt(events, index, date)
		index = next
		const result = stepDate(acc, states, scenario, date, dayEvents)
		if (result !== undefined) return attachLevies(result, states, levies, endDate(result, timeline))
	}
	const run = { snapshots: acc.snapshots, totals: acc.totals }
	return attachLevies({ ok: true, run }, states, levies, timeline.horizon)
}
