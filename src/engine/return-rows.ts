import { countedDays } from "../calendar/counted"
import type { AccountId, DateString, Timeline } from "../types"
import type { ResolvedReturns, ResolvedRow, ReturnSeries, Returns } from "./returns"

/** Row `i` owns the day-steps up to the next row's `from`; the last row owns up to the horizon. */
function resolveSeries(series: ReturnSeries, horizon: DateString): readonly ResolvedRow[] {
	return series.rows.map((row, index) => {
		const next = series.rows[index + 1]
		const to = next === undefined ? horizon : next.from
		return { from: row.from, to, returnBps: row.returnBps, days: countedDays(row.from, to) }
	})
}

/** Fixes every Return row's window and day count once, where the Timeline is in hand. */
export function resolveReturns(returns: Returns | undefined, timeline: Timeline): ResolvedReturns {
	const resolved = new Map<AccountId, readonly ResolvedRow[]>()
	if (returns === undefined) return resolved
	for (const series of returns.series) {
		resolved.set(series.account, resolveSeries(series, timeline.horizon))
	}
	return resolved
}
