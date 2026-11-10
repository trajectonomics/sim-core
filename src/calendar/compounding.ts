import type { CompoundingPeriod, DateString } from "../types"
import { addDays } from "./arith"
import { daysInMonth, formatDate, parseDate } from "./civil"
import { countedSpan } from "./counted"

/** Months in one compounding period. */
const MONTHS: Readonly<Record<CompoundingPeriod, number>> = {
	monthly: 1,
	quarterly: 3,
	semiannual: 6,
	annual: 12,
}

export function periodMonths(period: CompoundingPeriod): number {
	return MONTHS[period]
}

/** How many periods a year holds: 12, 4, 2 or 1. */
export function periodsPerYear(period: CompoundingPeriod): number {
	return 12 / MONTHS[period]
}

/** The zero-based month index of the period containing `month`, within `year`. */
function startMonthIndex(year: number, month: number, period: CompoundingPeriod): number {
	return year * 12 + (month - 1) - ((month - 1) % MONTHS[period])
}

/** First day of the compounding period containing `date`. */
export function periodStart(date: DateString, period: CompoundingPeriod): DateString {
	const { year, month } = parseDate(date)
	const index = startMonthIndex(year, month, period)
	return formatDate({ year: Math.floor(index / 12), month: (index % 12) + 1, day: 1 })
}

/** Last day of the compounding period containing `date`: the date its interest capitalises. */
export function periodEnd(date: DateString, period: CompoundingPeriod): DateString {
	const { year, month } = parseDate(date)
	const index = startMonthIndex(year, month, period) + MONTHS[period] - 1
	const lastYear = Math.floor(index / 12)
	const lastMonth = (index % 12) + 1
	return formatDate({ year: lastYear, month: lastMonth, day: daysInMonth(lastYear, lastMonth) })
}

/** Counted days in the whole period containing `date`: the capitalisation denominator's length. */
export function periodCountedDays(date: DateString, period: CompoundingPeriod): number {
	return countedSpan(periodStart(date, period), periodEnd(date, period))
}

/**
 * The compounding date the accrual from `asOf` will reach, or `undefined` when no later date
 * exists. The accrual period is the one containing the day after `asOf`, so a compounding date
 * that `asOf` already is has closed.
 */
export function nextCompoundingDate(
	asOf: DateString,
	period: CompoundingPeriod,
): DateString | undefined {
	const next = addDays(asOf, 1)
	if (next === asOf) return undefined
	return periodEnd(next, period)
}
