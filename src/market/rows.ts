import { addMonthsClamped } from "../calendar/arith"
import type { DateString, Timeline } from "../types"

export const MAX_MARKET_ROWS = 1200

function monthStart(date: DateString): DateString {
	return `${date.slice(0, 7)}-01`
}

/**
 * One Market row per month from the Timeline start to its horizon, one month start each; the
 * last window ends at the horizon. Returns at most `MAX_MARKET_ROWS + 1` dates so a caller can
 * detect an over-long Timeline instead of silently truncating it.
 */
export function marketRowDates(timeline: Timeline): readonly DateString[] {
	const dates: DateString[] = []
	let date = timeline.start
	while (date < timeline.horizon && dates.length <= MAX_MARKET_ROWS) {
		dates.push(date)
		date = addMonthsClamped(monthStart(date), 1)
	}
	return dates
}
