import type { ConstMeasure, DateString } from "../types"
import { oracleGrowthYears } from "./oracle-date"
import { oracleGrow } from "./oracle-money"

/**
 * A constant: with `steps`, the last value on or before `periodEnd` (`date` when omitted);
 * with `growth`, grown once per whole year from `asOf` to `date` through naive daily compounding.
 */
export function oracleConstValue(
	measure: ConstMeasure,
	date: DateString,
	inflation: number,
	periodEnd: DateString = date,
): bigint {
	const { value, asOf, growth, steps } = measure
	if (steps !== undefined) {
		let found = value
		for (const step of steps) {
			if (step.from > periodEnd) break
			found = step.value
		}
		return BigInt(found)
	}
	if (growth === undefined || asOf === undefined) return BigInt(value)
	const rate = growth === "inflation" ? inflation : growth.bps
	const grown = oracleGrow(BigInt(Math.abs(value)), rate, oracleGrowthYears(asOf, date) * 365)
	return value < 0 ? -grown : grown
}
