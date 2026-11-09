import { isValidDate } from "../check/date"
import { isRecord } from "../check/shape"
import type { DateString } from "../types"
import { dayNumber } from "./arith"
import { isWeekendDay, type ResolvedCalendar } from "./business"

/** A closure this long is rejected: a period may not settle a whole year late (ADR 0006). */
const UNUSABLE_RUN = 366

/** The longest continuous weekend run there is, so a longer gap between Holidays breaks a closure. */
const MAX_WEEKEND_RUN = 2

/** Whether `value` is an array of valid dates, so the closure rule can be applied to it. */
export function isHolidayList(value: unknown): value is readonly DateString[] {
	if (!Array.isArray(value)) return false
	for (let index = 0; index < value.length; index++) if (!isValidDate(value[index])) return false
	return true
}

/** Index of the first Holiday that repeats an earlier one, or undefined. Order is ignored. */
export function duplicateHolidayIndex(holidays: readonly unknown[]): number | undefined {
	const seen = new Set<string>()
	for (let index = 0; index < holidays.length; index++) {
		const date = holidays[index]
		if (typeof date !== "string") continue
		if (seen.has(date)) return index
		seen.add(date)
	}
	return undefined
}

/** Ascending, de-duplicated day numbers of the dates a Holiday list names. */
function sortedDayNumbers(holidays: readonly DateString[]): readonly number[] {
	const numbers = holidays.map((holiday) => dayNumber(holiday))
	numbers.sort((left, right) => left - right)
	return numbers.filter((number, index) => index === 0 || number !== numbers[index - 1])
}

/** Whether every day strictly between two Holidays is a weekend day, so the closure continues. */
function bridgedByWeekend(end: number, next: number): boolean {
	if (next - end > MAX_WEEKEND_RUN + 1) return false
	for (let day = end + 1; day < next; day++) if (!isWeekendDay(day)) return false
	return true
}

/** The closed run a Holiday block leaves: the block plus the weekend days touching either end. */
function closedSpan(start: number, end: number): number {
	let first = start
	while (isWeekendDay(first - 1)) first--
	let last = end
	while (isWeekendDay(last + 1)) last++
	return last - first + 1
}

/** The longest run of consecutive non-business days one Holiday list creates, in days. */
function longestClosure(days: readonly number[]): number {
	let longest = 0
	let start = days[0] ?? 0
	let end = start
	for (let index = 1; index < days.length; index++) {
		const day = days[index]!
		if (!bridgedByWeekend(end, day)) {
			longest = Math.max(longest, closedSpan(start, end))
			start = day
		}
		end = day
	}
	return days.length === 0 ? 0 : Math.max(longest, closedSpan(start, end))
}

/** Whether the Holidays leave a run of 366 or more consecutive non-business days. */
export function closesWholeYear(holidays: readonly DateString[]): boolean {
	return longestClosure(sortedDayNumbers(holidays)) >= UNUSABLE_RUN
}

function usableHolidays(raw: Readonly<Record<string, unknown>>): readonly DateString[] | undefined {
	const holidays = raw["holidays"]
	if (!isHolidayList(holidays) || duplicateHolidayIndex(holidays) !== undefined) return undefined
	return closesWholeYear(holidays) ? undefined : holidays
}

/**
 * The Calendar the engine applies, or `undefined` when there is nothing to apply: an absent
 * section, the `exact` rule, or a Calendar that fails any rule. The `check()` rules and the engine
 * call this same predicate, so they cannot disagree about whether a Calendar is usable. It reads a
 * raw value because the standalone Carry-in check cannot see other checks' results.
 */
export function resolvedCalendar(scenario: unknown): ResolvedCalendar | undefined {
	if (!isRecord(scenario) || !Object.hasOwn(scenario, "calendar")) return undefined
	const raw = scenario["calendar"]
	if (!isRecord(raw) || raw["dayRule"] !== "next") return undefined
	const holidays = usableHolidays(raw)
	if (holidays === undefined) return undefined
	return { rule: "next", holidays: new Set(holidays) }
}
