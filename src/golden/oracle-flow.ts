import type { Fixture } from "../fixtures/fixture"
import type { DateString, Flow, Frequency } from "../types"
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

function rangeEvents(flow: Flow, from: DateString, last: DateString): OracleEvent[] {
	const events: OracleEvent[] = []
	for (let index = 0; ; index++) {
		const date = eventDate(flow.start, flow.frequency, index)
		if (date > last) return events
		if (date >= from) events.push({ date, flow, years: oracleGrowthYears(flow.start, date) })
	}
}

function onceEvents(flow: Flow, from: DateString, last: DateString): OracleEvent[] {
	if (flow.start < from || flow.start > last) return []
	return [{ date: flow.start, flow, years: 0 }]
}

export function oracleEvents(
	flows: readonly Flow[],
	start: DateString,
	horizon: DateString,
): readonly OracleEvent[] {
	const events: OracleEvent[] = []
	for (const flow of flows) {
		const last = flow.end !== undefined && flow.end < horizon ? flow.end : horizon
		if (flow.frequency === "once") events.push(...onceEvents(flow, start, last))
		else events.push(...rangeEvents(flow, start, last))
	}
	return events
}

export function oracleAmount(event: OracleEvent, inflation: number): bigint {
	const growth = event.flow.growth
	const rate = growth === "inflation" ? inflation : growth.bps
	return oracleGrow(BigInt(event.flow.amount), rate, event.years * 365)
}

/** Every event in the timeline, grouped by date. */
export function oracleEventsByDate(
	fixture: Fixture,
): ReadonlyMap<DateString, readonly OracleEvent[]> {
	const { scenario, timeline } = fixture
	const byDate = new Map<DateString, OracleEvent[]>()
	for (const event of oracleEvents(scenario.flows, timeline.start, timeline.horizon)) {
		const list = byDate.get(event.date) ?? []
		list.push(event)
		byDate.set(event.date, list)
	}
	return byDate
}
