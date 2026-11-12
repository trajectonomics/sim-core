import { countedDays } from "../calendar/counted"
import { deflate } from "../money/growth"
import type { BasisPoints, DateString } from "../types"
import { buildWindow, type ExpenseWindow, type WindowOutcome } from "./expense-window"

/** The money the reference reports in, and the date it deflates to when it is real. */
export interface ReferenceMoney {
	readonly start: DateString
	readonly inflation: BasisPoints
	readonly real: boolean
}

/** Deflates each measurement from its own Landed date before summing, as ADR 0007 fixes. */
export function deflated(window: ExpenseWindow, money: ReferenceMoney): WindowOutcome {
	const measurements: { readonly date: DateString; readonly amount: bigint }[] = []
	for (let index = 0; index < window.dates.length; index++) {
		const date = window.dates[index]!
		const amount = window.cumulative[index + 1]! - window.cumulative[index]!
		measurements.push({
			date,
			amount: deflate(amount, money.inflation, countedDays(money.start, date)),
		})
	}
	return { ok: true, window: buildWindow(measurements) }
}
