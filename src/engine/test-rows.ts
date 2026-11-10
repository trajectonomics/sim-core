import type { DateString, MinorUnits } from "../types"
import type { Projection, ProjectionRow, SettlementPeriod } from "../types/projection"

export function periodFrom(projection: Projection, from: DateString): SettlementPeriod {
	const period = projection.levies
		?.flatMap((report) => report.periods)
		.find((item) => item.from === from)
	if (period === undefined) throw new Error(`Missing Settlement period ${from}`)
	return period
}

export function rowAt(projection: Projection, date: DateString): ProjectionRow {
	const row = projection.rows.find((item) => item.date === date)
	if (!row) throw new Error(`Missing row ${date}`)
	return row
}

export function amounts(row: ProjectionRow): Readonly<Record<string, MinorUnits>> {
	return Object.fromEntries(row.balances.map((balance) => [balance.account, balance.amount]))
}
