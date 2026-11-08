import { addMonthsClamped } from "../calendar/arith"
import type { DateString, Timeline } from "../types"

/** The first day of `date`'s month. */
function monthStart(date: DateString): DateString {
	return `${date.slice(0, 7)}-01`
}

/** First-of-month candidates from the first month start at or after `Timeline.start` through the horizon. */
export function candidateMonths(timeline: Timeline): readonly DateString[] {
	const first = timeline.start.endsWith("-01")
		? timeline.start
		: addMonthsClamped(monthStart(timeline.start), 1)
	const months: DateString[] = []
	for (let date = first; date <= timeline.horizon; date = addMonthsClamped(date, 1)) {
		months.push(date)
	}
	return months
}
