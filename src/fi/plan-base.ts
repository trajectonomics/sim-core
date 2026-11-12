import type { ResolvedCalendar } from "../calendar/business"
import { resolvedCalendar } from "../calendar/resolve"
import { buildEvents, type DatedEvent } from "../engine/events"
import type { ResolvedReturns } from "../engine/returns"
import type { Baseline, DateString, Scenario, Timeline } from "../types"
import type { FinancialIndependenceOptions } from "../types/financial-independence"
import { candidateMonths } from "./candidates"
import { expenseWindow } from "./expenses"
import { baselinePrefix, levyPlan, type Prefix } from "./prefix"
import { type ReferencePlan, referencePlan } from "./reference-plan"
import { type RequirementTable, requirementTable } from "./required"
import { type ScanGrid, scanGrid } from "./scan-grid"
import type { SearchInput } from "./search"

export interface ScanBase {
	readonly baseline: Baseline
	readonly scenario: Scenario
	readonly timeline: Timeline
	readonly events: readonly DatedEvent[]
	readonly calendar: ResolvedCalendar | undefined
	readonly candidates: readonly DateString[]
	readonly requirement: RequirementTable
	readonly reference: ReferencePlan
	readonly grid: ScanGrid
}

/** The state-independent scan inputs; `undefined` when the candidate grid is empty. */
export function planBase(
	baseline: Baseline,
	scenario: Scenario,
	timeline: Timeline,
	options: FinancialIndependenceOptions,
): ScanBase | undefined {
	const candidates = candidateMonths(timeline)
	if (candidates.length === 0) return undefined
	const calendar = resolvedCalendar(scenario)
	const events = buildEvents(scenario, timeline, calendar)
	const levy = levyPlan(scenario, timeline, calendar)
	const expenses = expenseWindow(scenario, timeline, options, candidates[0]!, calendar)
	return {
		baseline,
		scenario,
		timeline,
		events,
		calendar,
		candidates,
		requirement: requirementTable(expenses, options.minBufferMonths ?? 0),
		reference: referencePlan(
			options.method === "survival" ? options.reference : undefined,
			scenario,
			timeline,
			expenses,
			calendar,
		),
		grid: scanGrid(
			events,
			timeline,
			options,
			candidates[0]!,
			levy.settlementDates,
			calendar,
			scenario.economy.inflation,
		),
	}
}

/** Walks the unchanged Scenario once, saving states and Levy tallies before each candidate month. */
export function prefixFor(base: ScanBase, series?: ResolvedReturns): Prefix {
	return baselinePrefix(
		base.baseline,
		base.scenario,
		base.timeline,
		base.events,
		base.candidates,
		base.calendar,
		series,
	)
}

export function inputFor(base: ScanBase, prefix: Prefix): SearchInput {
	return {
		scenario: base.scenario,
		prefix,
		requirement: base.requirement,
		reference: base.reference,
		grid: base.grid,
	}
}
