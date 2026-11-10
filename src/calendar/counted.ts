import { BoundedCache } from "../bounded-cache"
import type { DateString } from "../types"
import { dayNumber } from "./arith"
import { isLeapYear, parseDate } from "./civil"

const leapDays: BoundedCache<DateString, number> = new BoundedCache(65536)

/** Number of Feb 29 dates in years 1..year that are not after `date`. */
function leapDaysThrough(date: DateString): number {
	const cached = leapDays.get(date)
	if (cached !== undefined) return cached
	const { year, month, day } = parseDate(date)
	let count = Math.floor(year / 4) - Math.floor(year / 100) + Math.floor(year / 400)
	if (isLeapYear(year) && (month < 2 || (month === 2 && day < 29))) count--
	leapDays.set(date, count)
	return count
}

/** Actual/365 No Leap: actual days minus the Feb 29s in `(from, to]`. */
export function countedDays(from: DateString, to: DateString): number {
	if (from === to) return 0
	return dayNumber(to) - dayNumber(from) - (leapDaysThrough(to) - leapDaysThrough(from))
}

/** Whether `date` is Feb 29. */
function isLeapDay(date: DateString): boolean {
	const { month, day } = parseDate(date)
	return month === 2 && day === 29
}

/**
 * Actual/365 No Leap over the inclusive range `[from, to]`: actual days minus its Feb 29s. A
 * Compounding period's length is measured this way, so the lower bound needs no earlier date.
 */
export function countedSpan(from: DateString, to: DateString): number {
	const leapDays = leapDaysThrough(to) - leapDaysThrough(from) + (isLeapDay(from) ? 1 : 0)
	return dayNumber(to) - dayNumber(from) + 1 - leapDays
}
