import { countedDays } from "../calendar/counted"
import { roundHalfUp } from "../money/round"
import type { DateString } from "../types"
import type { ResolvedSeries } from "./returns"

const SPAN_SCALE = 10000n

/** `amount` over `held` of a row's `days`, rounded once, half-up. */
function spanGrow(amount: bigint, returnBps: number, days: number, held: number): bigint {
	const denominator = SPAN_SCALE * BigInt(days)
	const numerator = amount * (denominator + BigInt(returnBps) * BigInt(held))
	return roundHalfUp(numerator, denominator)
}

/** Applies every Return row's span return over the counted days `[asOf, date]` holds. */
export function walkRows(
	balance: bigint,
	asOf: DateString,
	date: DateString,
	series: ResolvedSeries,
): bigint {
	let amount = balance
	for (const row of series) {
		const from = asOf > row.from ? asOf : row.from
		const to = date < row.to ? date : row.to
		const held = countedDays(from, to)
		if (held > 0) amount = spanGrow(amount, row.returnBps, row.days, held)
	}
	return amount
}
