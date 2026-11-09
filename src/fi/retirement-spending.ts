import { addMonthsClamped, growthYears } from "../calendar/arith"
import { landedDate, type ResolvedCalendar } from "../calendar/business"
import { amountAt } from "../engine/amount"
import type { DatedEvent } from "../engine/events"
import type { DateString, ExpenseFlow, Growth, Timeline } from "../types"
import type { SurvivalOptions } from "../types/financial-independence"

const RETIREMENT_ID = "fi-retirement-spending"

type RetirementSpending = NonNullable<SurvivalOptions["retirementSpending"]>

/** One retirement expense and the Landed date it moves on. */
export interface RetirementMeasurement {
	readonly date: DateString
	readonly amount: bigint
}

/** The synthetic Expense Flow behind retirement spending; its years are anchored at the Timeline start. */
export function retirementFlow(
	timeline: Timeline,
	amount: number,
	growth: Growth,
	id: string = RETIREMENT_ID,
): ExpenseFlow {
	return { id, kind: "expense", amount, frequency: "monthly", start: timeline.start, growth }
}

/**
 * Monthly retirement expenses from `from` through `through`. They are Flow Due dates like any
 * other, so they land on Business days: retirement spending is data in the equivalent Scenario.
 */
export function retirementMeasurements(
	timeline: Timeline,
	retirement: RetirementSpending,
	from: DateString,
	through: DateString,
	inflation: number,
	calendar: ResolvedCalendar | undefined,
): readonly RetirementMeasurement[] {
	const flow = retirementFlow(timeline, retirement.amount, retirement.growth)
	const measurements: RetirementMeasurement[] = []
	for (let due = from; due <= through; due = addMonthsClamped(due, 1)) {
		const event: DatedEvent = { date: due, flow, years: growthYears(timeline.start, due) }
		measurements.push({ date: landedDate(due, calendar), amount: amountAt(event, inflation) })
	}
	return measurements
}

/** The retirement events a candidate month adds, on their Landed dates. */
export function retirementEvents(
	month: DateString,
	timeline: Timeline,
	retirement: RetirementSpending,
	id: string,
	calendar: ResolvedCalendar | undefined,
): readonly DatedEvent[] {
	const flow = retirementFlow(timeline, retirement.amount, retirement.growth, id)
	const events: DatedEvent[] = []
	for (let due = month; due <= timeline.horizon; due = addMonthsClamped(due, 1)) {
		const date = landedDate(due, calendar)
		events.push({ date, flow, years: growthYears(timeline.start, due) })
	}
	return events
}

/** A retirement id no scenario Flow already uses. */
export function uniqueRetirementId(events: readonly DatedEvent[]): string {
	const ids = new Set(events.map((event) => event.flow.id))
	let id = RETIREMENT_ID
	while (ids.has(id)) id += "-"
	return id
}
