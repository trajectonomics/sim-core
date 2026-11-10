import type { DateString } from "../types"

const DIGIT_ZERO = 48
const HYPHEN = 45
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

export interface CivilDate {
	readonly year: number
	readonly month: number
	readonly day: number
}

export function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function daysInMonth(year: number, month: number): number {
	return month === 2 && isLeapYear(year) ? 29 : (MONTH_DAYS[month - 1] ?? 0)
}

function digitAt(value: DateString, index: number): number {
	const digit = value.charCodeAt(index) - DIGIT_ZERO
	if (digit < 0 || digit > 9) throw new RangeError(`Invalid date: ${value}`)
	return digit
}

function digits(value: DateString, from: number, to: number): number {
	let total = 0
	for (let index = from; index < to; index++) total = total * 10 + digitAt(value, index)
	return total
}

/** Parses an already validated `YYYY-MM-DD` date; character codes, no regular expression. */
export function parseDate(value: DateString): CivilDate {
	if (value.length !== 10 || value.charCodeAt(4) !== HYPHEN || value.charCodeAt(7) !== HYPHEN) {
		throw new RangeError(`Invalid date: ${value}`)
	}
	return { year: digits(value, 0, 4), month: digits(value, 5, 7), day: digits(value, 8, 10) }
}

function pad(value: number, width: number): string {
	return String(value).padStart(width, "0")
}

export function formatDate({ year, month, day }: CivilDate): DateString {
	return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
}
