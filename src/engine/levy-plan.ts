import { addDays, addMonthsClamped } from "../calendar/arith"
import { formatDate, parseDate } from "../calendar/civil"
import type { DateString, Levy, MonthDay } from "../types"

export interface SettlementPeriodPlan {
	readonly index: number
	readonly from: DateString
	readonly to: DateString
	readonly settlementDate: DateString
}

const LAST_DATE: DateString = "9999-12-31"

function dateIn(year: number, monthDay: MonthDay): DateString {
	if (year > 9999) return LAST_DATE
	return formatDate({ year, month: monthDay.month, day: monthDay.day })
}

/** The first `settlement` date strictly after `to`. */
export function settlementAfter(to: DateString, settlement: MonthDay): DateString {
	const year = parseDate(to).year
	const sameYear = dateIn(year, settlement)
	return sameYear > to ? sameYear : dateIn(year + 1, settlement)
}

/** Twelve-month periods from `start`, with the Settlement date that follows each one. */
export function settlementPeriods(
	start: DateString,
	horizon: DateString,
	levy: Levy,
): readonly SettlementPeriodPlan[] {
	const periods: SettlementPeriodPlan[] = []
	for (let index = 0; ; index++) {
		const from = addMonthsClamped(start, index * 12)
		const previous = periods[periods.length - 1]
		if (from > horizon || (previous !== undefined && previous.from === from)) return periods
		const to = addDays(addMonthsClamped(start, (index + 1) * 12), -1)
		periods.push({ index, from, to, settlementDate: settlementAfter(to, levy.settlement) })
	}
}

/** Index of the period containing `date`, or -1 before the first period. */
export function settlementPeriodIndexAt(
	periods: readonly SettlementPeriodPlan[],
	date: DateString,
): number {
	let low = 0
	let high = periods.length - 1
	let found = -1
	while (low <= high) {
		const middle = Math.floor((low + high) / 2)
		const period = periods[middle]
		if (period !== undefined && period.from <= date) {
			found = middle
			low = middle + 1
		} else {
			high = middle - 1
		}
	}
	return found
}
