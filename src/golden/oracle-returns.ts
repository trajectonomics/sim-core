import type { DateString } from "../types"
import { oracleCountedDays } from "./oracle-date"

export interface OracleRow {
	readonly from: DateString
	readonly to: DateString
	readonly returnBps: number
	readonly days: number
}

export type OracleSeries = readonly OracleRow[]

interface Fraction {
	readonly numerator: bigint
	readonly denominator: bigint
}

function roundHalfUp(value: Fraction): bigint {
	const twice = value.numerator * 2n
	return (twice + value.denominator) / (value.denominator * 2n)
}

/** One row's span factor as an exact rational: (10000·D + bps·h) / (10000·D). */
function spanFactor(row: OracleRow, held: number): Fraction {
	const denominator = BigInt(10000 * row.days)
	return { numerator: denominator + BigInt(row.returnBps * held), denominator }
}

/** Resolves raw rows with its own day count, as a run start must. */
export function oracleResolveRows(
	rows: readonly { readonly from: DateString; readonly returnBps: number }[],
	horizon: DateString,
): OracleSeries {
	return rows.map((row, index) => {
		const next = rows[index + 1]
		const to = next === undefined ? horizon : next.from
		return { from: row.from, to, returnBps: row.returnBps, days: oracleCountedDays(row.from, to) }
	})
}

/** Applies each row's span return once over the counted days `[asOf, date]` holds. */
export function oracleSpanGrow(
	amount: bigint,
	asOf: DateString,
	date: DateString,
	rows: OracleSeries,
): bigint {
	let value = amount
	for (const row of rows) {
		const from = asOf > row.from ? asOf : row.from
		const to = date < row.to ? date : row.to
		const held = oracleCountedDays(from, to)
		if (held <= 0) continue
		const factor = spanFactor(row, held)
		value = roundHalfUp({ numerator: value * factor.numerator, denominator: factor.denominator })
	}
	return value
}
