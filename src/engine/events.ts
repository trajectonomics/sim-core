import type { ResolvedCalendar } from "../calendar/business"
import { occurrences } from "../calendar/occurrence"
import type { DateString, Flow, Scenario, Timeline } from "../types"
import { compareIds } from "./order"

export interface DatedEvent {
	readonly date: DateString
	readonly flow: Flow
	readonly years: number
}

/** All flow Occurrences in the timeline, on their Landed dates, sorted by date then flow id. */
export function buildEvents(
	scenario: Scenario,
	timeline: Timeline,
	calendar: ResolvedCalendar | undefined,
): readonly DatedEvent[] {
	const events: DatedEvent[] = []
	for (const flow of scenario.flows) {
		const found = occurrences(
			flow.start,
			flow.frequency,
			flow.end,
			timeline.start,
			timeline.horizon,
			calendar,
		)
		for (const occurrence of found) {
			events.push({ date: occurrence.date, flow, years: occurrence.years })
		}
	}
	return events.sort((left, right) =>
		left.date === right.date
			? compareIds(left.flow.id, right.flow.id)
			: left.date < right.date
				? -1
				: 1,
	)
}

/** The slice of events sharing `date`, starting at `index`, and the index just past them. */
export function flowsAt(
	events: readonly DatedEvent[],
	index: number,
	date: DateString,
): readonly [number, readonly DatedEvent[]] {
	let next = index
	while (next < events.length && events[next]?.date === date) next++
	return [next, events.slice(index, next)]
}
