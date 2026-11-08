import { addMonthsClamped } from "../calendar/arith"
import { formatDate, parseDate } from "../calendar/civil"
import type { DateString, MonthDay } from "../types"

const LAST_DATE: DateString = "9999-12-31"

/** `monthDay` in `year`, saturating after the last supported year. */
export function dateIn(year: number, monthDay: MonthDay): DateString {
	if (year > 9999) return LAST_DATE
	return formatDate({ year, month: monthDay.month, day: monthDay.day })
}

/** The first `settlement` date strictly after `to`. */
export function settlementAfter(to: DateString, settlement: MonthDay): DateString {
	const year = parseDate(to).year
	const sameYear = dateIn(year, settlement)
	return sameYear > to ? sameYear : dateIn(year + 1, settlement)
}

/** The start of the period containing `date`, or undefined before year 1. */
export function periodStartAtOrBefore(date: DateString, period: MonthDay): DateString | undefined {
	const year = parseDate(date).year
	const candidate = dateIn(year, period)
	if (candidate <= date) return candidate
	return year > 1 ? dateIn(year - 1, period) : undefined
}

/** The start twelve months before `start`, or undefined before year 1. */
export function previousPeriodStart(start: DateString, period: MonthDay): DateString | undefined {
	const year = parseDate(start).year
	return year > 1 ? dateIn(year - 1, period) : undefined
}

/** First day of the twelve-month period after `start`. */
export function nextPeriodStart(start: DateString): DateString {
	return addMonthsClamped(start, 12)
}
