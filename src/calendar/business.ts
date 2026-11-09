import type { DateString, DayRule } from "../types"
import { addDays, dayNumber } from "./arith"

/** A Calendar the engine applies: a rule and its Holidays as a membership test. */
export interface ResolvedCalendar {
	readonly rule: DayRule
	readonly holidays: ReadonlySet<DateString>
}

/**
 * Ordinal 0 is 0001-01-01, a Monday, so a day number 5 or 6 modulo 7 is a weekend day. Integer
 * arithmetic only: no wall clock, no locale and no timezone take part.
 */
export function isWeekendDay(number: number): boolean {
	return number % 7 >= 5
}

/** A date that is neither Saturday, Sunday nor a Holiday. */
export function isBusinessDay(date: DateString, holidays: ReadonlySet<DateString>): boolean {
	return !isWeekendDay(dayNumber(date)) && !holidays.has(date)
}

/**
 * The Landed date of a Due date: one day forward at a time until the date is a Business day. The
 * walk also stops when a step cannot advance, which `addDays` reports by returning the same date at
 * the end of the supported range, so the shift always terminates.
 */
export function landedDate(due: DateString, calendar: ResolvedCalendar | undefined): DateString {
	if (calendar === undefined) return due
	let date = due
	while (!isBusinessDay(date, calendar.holidays)) {
		const next = addDays(date, 1)
		if (next === date) return date
		date = next
	}
	return date
}

/** The furthest a `next` shift can move a Due date: a longer run of closures is rejected. */
export function shiftBound(calendar: ResolvedCalendar | undefined): number {
	return calendar === undefined ? 0 : 7 * (calendar.holidays.size + 1)
}
