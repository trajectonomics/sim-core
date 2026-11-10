import type { DateString } from "../types"
import { daysInMonth, formatDate, parseDate } from "./civil"

export function daysBeforeYear(year: number): number {
	const previous = year - 1
	return (
		365 * previous +
		Math.floor(previous / 4) -
		Math.floor(previous / 100) +
		Math.floor(previous / 400)
	)
}

function daysBeforeMonth(year: number, month: number): number {
	let days = 0
	for (let m = 1; m < month; m++) days += daysInMonth(year, m)
	return days
}

const dayNumbers: Map<DateString, number> = new Map()
const DAY_CACHE_LIMIT = 65536

/** Zero-based serial day number; 0001-01-01 is 0. Cached per date, purely additively. */
export function dayNumber(date: DateString): number {
	const cached = dayNumbers.get(date)
	if (cached !== undefined) return cached
	const { year, month, day } = parseDate(date)
	const value = daysBeforeYear(year) + daysBeforeMonth(year, month) + day - 1
	if (dayNumbers.size >= DAY_CACHE_LIMIT) dayNumbers.clear()
	dayNumbers.set(date, value)
	return value
}

const FIRST_DATE: DateString = "0001-01-01"
const LAST_DATE: DateString = "9999-12-31"
const LAST_DAY = dayNumber(LAST_DATE)

/** Inverse of `dayNumber`, saturating at the supported range; no wall clock is involved. */
export function fromDayNumber(value: number): DateString {
	if (value <= 0) return FIRST_DATE
	if (value >= LAST_DAY) return LAST_DATE
	let year = Math.floor(value / 366) + 1
	while (daysBeforeYear(year + 1) <= value) year++
	while (daysBeforeYear(year) > value) year--
	let remaining = value - daysBeforeYear(year)
	let month = 1
	while (remaining >= daysInMonth(year, month)) {
		remaining -= daysInMonth(year, month)
		month++
	}
	return formatDate({ year, month, day: remaining + 1 })
}

export function addDays(date: DateString, days: number): DateString {
	return fromDayNumber(dayNumber(date) + days)
}

/** Adds calendar months, clamping the day to the target month's last day. */
export function addMonthsClamped(date: DateString, months: number): DateString {
	if (months === 0) return date
	const { year, month, day } = parseDate(date)
	const total = year * 12 + (month - 1) + months
	const targetYear = Math.floor(total / 12)
	if (targetYear > 9999) return LAST_DATE
	const targetMonth = (((total % 12) + 12) % 12) + 1
	return formatDate({
		year: targetYear,
		month: targetMonth,
		day: Math.min(day, daysInMonth(targetYear, targetMonth)),
	})
}

/** Number of annual growth anniversaries reached, with `Feb 29 -> Feb 28` clamping. */
export function growthYears(start: DateString, date: DateString): number {
	const years = parseDate(date).year - parseDate(start).year
	if (years <= 0) return 0
	return addMonthsClamped(start, years * 12) <= date ? years : years - 1
}
