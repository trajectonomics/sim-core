import type { DateString, Frequency } from "../types"
import { addDays, addMonthsClamped, dayNumber, growthYears } from "./arith"
import { landedDate, type ResolvedCalendar, shiftBound } from "./business"

export interface Occurrence {
	readonly date: DateString
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

function occurrenceDate(start: DateString, frequency: Frequency, index: number): DateString {
	const months = stepMonths(frequency)
	if (months !== undefined) return addMonthsClamped(start, index * months)
	const days = stepDays(frequency) ?? 1
	return addDays(start, index * days)
}

function firstIndex(start: DateString, frequency: Frequency, from: DateString): number {
	if (from <= start) return 0
	const months = stepMonths(frequency)
	if (months !== undefined) {
		const s = start.split("-")
		const f = from.split("-")
		const diff = (Number(f[0]) - Number(s[0])) * 12 + (Number(f[1]) - Number(s[1]))
		return Math.max(0, Math.floor(diff / months))
	}
	const days = stepDays(frequency) ?? 1
	return Math.max(0, Math.floor((dayNumber(from) - dayNumber(start)) / days))
}

function rangeOccurrences(
	start: DateString,
	frequency: Frequency,
	last: DateString,
	from: DateString,
	to: DateString,
	calendar: ResolvedCalendar | undefined,
): readonly Occurrence[] {
	const result: Occurrence[] = []
	for (let index = firstIndex(start, frequency, addDays(from, -shiftBound(calendar))); ; index++) {
		const due = occurrenceDate(start, frequency, index)
		if (due > last) return result
		const landed = landedDate(due, calendar)
		if (landed > to) return result
		if (landed >= from) result.push({ date: landed, years: growthYears(start, due) })
	}
}

/** A `once` Flow has one Due date, and only its Landed date is compared with the window. */
function onceOccurrence(
	start: DateString,
	last: DateString,
	from: DateString,
	to: DateString,
	calendar: ResolvedCalendar | undefined,
): readonly Occurrence[] {
	if (start > last) return []
	const landed = landedDate(start, calendar)
	return landed >= from && landed <= to ? [{ date: landed, years: 0 }] : []
}

/**
 * Occurrences in `[from, to]`, with `end` (inclusive) capping their Due dates. Amounts and growth
 * anniversaries stay anchored on the Due date; only the reported date is the Landed one, so a Due
 * date just before `from` still lands inside the window and a Landed date outside it is dropped.
 */
export function occurrences(
	start: DateString,
	frequency: Frequency,
	end: DateString | undefined,
	from: DateString,
	to: DateString,
	calendar: ResolvedCalendar | undefined,
): readonly Occurrence[] {
	if (to < from) return []
	const last = end !== undefined && end < to ? end : to
	if (frequency === "once") return onceOccurrence(start, last, from, to, calendar)
	return rangeOccurrences(start, frequency, last, from, to, calendar)
}
