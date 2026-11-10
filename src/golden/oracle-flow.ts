import type { Fixture } from "../fixtures/fixture"
import type { DateString, FixedAmount, Flow, Frequency } from "../types"
import { isFixed } from "../types"
import { type OracleCalendar, oracleCalendar, oracleLand } from "./oracle-calendar"
import { oracleAddDays, oracleAddMonthsClamped, oracleGrowthYears } from "./oracle-date"
import { oracleGrow } from "./oracle-money"

export interface OracleEvent {
	readonly date: DateString
	readonly flow: Flow
	readonly years: number
}

function stepDays(frequency: Frequency): number | undefined {
	if (frequency === "daily") return 1
	if (frequency === "weekly") return 7
	if (frequency === "biweekly") return 14
	return undefined
}

function stepMonths(frequency: Frequency): number | undefined {
	if (frequency === "monthly") return 1
	if (frequency === "quarterly") return 3
	if (frequency === "annual") return 12
	return undefined
}

function eventDate(start: DateString, frequency: Frequency, index: number): DateString {
	const months = stepMonths(frequency)
	if (months !== undefined) return oracleAddMonthsClamped(start, index * months)
	return oracleAddDays(start, index * (stepDays(frequency) ?? 1))
}

function rangeEvents(
	flow: Flow,
	from: DateString,
	horizon: DateString,
	last: DateString,
	calendar: OracleCalendar | undefined,
): OracleEvent[] {
	const events: OracleEvent[] = []
	for (let index = 0; ; index++) {
		const due = eventDate(flow.start, flow.frequency, index)
		if (due > last) return events
		const date = oracleLand(due, calendar)
		if (date > horizon) return events
		if (date >= from) events.push({ date, flow, years: oracleGrowthYears(flow.start, due) })
	}
}

function onceEvents(
	flow: Flow,
	from: DateString,
	horizon: DateString,
	last: DateString,
	calendar: OracleCalendar | undefined,
): OracleEvent[] {
	if (flow.start > last) return []
	const date = oracleLand(flow.start, calendar)
	if (date < from || date > horizon) return []
	return [{ date, flow, years: 0 }]
}

export function oracleEvents(
	flows: readonly Flow[],
	start: DateString,
	horizon: DateString,
	calendar: OracleCalendar | undefined,
): readonly OracleEvent[] {
	const events: OracleEvent[] = []
	for (const flow of flows) {
		const last = flow.end !== undefined && flow.end < horizon ? flow.end : horizon
		events.push(
			...(flow.frequency === "once"
				? onceEvents(flow, start, horizon, last, calendar)
				: rangeEvents(flow, start, horizon, last, calendar)),
		)
	}
	return events
}

/** A fixed Flow's amount; the full-projection oracle does not model Derived amounts. */
export function oracleAmount(event: OracleEvent, inflation: number): bigint {
	const flow = event.flow
	if (!isFixed(flow)) throw new Error(`Oracle has no Derived amount for ${flow.id}`)
	const fixed = flow as Flow & FixedAmount
	const growth = fixed.growth
	const rate = growth === "inflation" ? inflation : growth.bps
	return oracleGrow(BigInt(fixed.amount), rate, event.years * 365)
}

/** Every event in the timeline, grouped by date. */
export function oracleEventsByDate(
	fixture: Fixture,
): ReadonlyMap<DateString, readonly OracleEvent[]> {
	const { scenario, timeline } = fixture
	const calendar = oracleCalendar(fixture)
	const byDate = new Map<DateString, OracleEvent[]>()
	for (const event of oracleEvents(scenario.flows, timeline.start, timeline.horizon, calendar)) {
		const list = byDate.get(event.date) ?? []
		list.push(event)
		byDate.set(event.date, list)
	}
	return byDate
}
