import { addDays } from "../calendar/arith"
import { carryInPeriods, dateIn, nextPeriodStart, settlementAfter } from "../levy/periods"
import type { DateString, Levy } from "../types"

export interface SettlementPeriodPlan {
	readonly index: number
	readonly from: DateString
	readonly to: DateString
	readonly settlementDate: DateString
}

/** The first period to report: the one containing `start`, plus an earlier one still settling after it. */
function firstPeriodStart(start: DateString, levy: Levy): DateString {
	return carryInPeriods(start, levy.period, levy.settlement).first ?? dateIn(1, levy.period)
}

/** Twelve-month periods from the Levy's period rule, through `horizon`, with their Settlements. */
export function settlementPeriods(
	start: DateString,
	horizon: DateString,
	levy: Levy,
): readonly SettlementPeriodPlan[] {
	const periods: SettlementPeriodPlan[] = []
	let from = firstPeriodStart(start, levy)
	for (let index = 0; ; index++) {
		if (from > horizon) return periods
		const next = nextPeriodStart(from)
		const to = addDays(next, -1)
		periods.push({ index, from, to, settlementDate: settlementAfter(to, levy.settlement) })
		if (next <= from) return periods
		from = next
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
