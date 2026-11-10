import { resolvedCalendar } from "../calendar/resolve"
import { buildEvents } from "../engine/events"
import type { Baseline, DateString, Scenario, Timeline } from "../types"
import type { SurvivalOptions } from "../types/financial-independence"
import { candidateMonths } from "./candidates"
import { expenseWindow } from "./expenses"
import { baselinePrefix, levyPlan } from "./prefix"
import type { SearchInput } from "./search"

/** Everything a scan needs except the candidate months it will visit. */
export interface ScanPlan {
	readonly input: SearchInput
	/** The full candidate grid. */
	readonly candidates: readonly DateString[]
	/** The candidates the scan visits: cut at the prefix stop when the prefix ran out. */
	readonly scanned: readonly DateString[]
}

/** Builds the state-independent scan inputs once; `undefined` when the candidate grid is empty. */
export function planScan(
	baseline: Baseline,
	scenario: Scenario,
	timeline: Timeline,
	options: SurvivalOptions,
): ScanPlan | undefined {
	const candidates = candidateMonths(timeline)
	if (candidates.length === 0) return undefined
	const calendar = resolvedCalendar(scenario)
	const events = buildEvents(scenario, timeline, calendar)
	const prefix = baselinePrefix(baseline, scenario, timeline, events, candidates, calendar)
	const scanned =
		prefix.problem === undefined
			? candidates
			: candidates.filter((month) => prefix.stoppedAt !== undefined && month <= prefix.stoppedAt)
	const levy = levyPlan(scenario, timeline, calendar)
	return {
		input: {
			scenario,
			timeline,
			options,
			events,
			prefix,
			expenses: expenseWindow(scenario, timeline, options, candidates[0]!, calendar),
			settlementDates: levy.settlementDates,
			minBufferMonths: options.minBufferMonths ?? 0,
			calendar,
		},
		candidates,
		scanned,
	}
}
