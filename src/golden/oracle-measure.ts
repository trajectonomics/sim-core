import type { DateString, Levy, LevyMeasure, Rounding } from "../types"
import { oracleConstValue } from "./oracle-const"

export { oracleConstValue }

export interface OracleTallies {
	readonly gross: ReadonlyMap<string, bigint>
	readonly funded: ReadonlyMap<string, bigint>
	readonly returns?: ReadonlyMap<string, bigint>
	readonly gains?: ReadonlyMap<string, bigint>
}

export interface OracleMeasures {
	readonly values: ReadonlyMap<string, bigint>
	readonly due: bigint
}

/** Exact `product / den` rounded as `rounding` says; a tie goes away from zero. */
export function oracleDivide(product: bigint, den: bigint, rounding: Rounding): bigint {
	const quotient = product / den
	const remainder = product - quotient * den
	if (remainder === 0n) return quotient
	if (rounding === "floor") return remainder < 0n ? quotient - 1n : quotient
	if (rounding === "ceil") return remainder > 0n ? quotient + 1n : quotient
	const double = remainder < 0n ? -remainder * 2n : remainder * 2n
	if (double < den) return quotient
	return remainder < 0n ? quotient - 1n : quotient + 1n
}

// BigInt has no Math.min or Math.max.
function lesser(left: bigint, right: bigint): bigint {
	if (left < right) return left
	return right
}

function greater(left: bigint, right: bigint): bigint {
	if (left > right) return left
	return right
}

function measureValue(
	measure: LevyMeasure,
	get: (id: string) => bigint,
	tallies: OracleTallies,
	date: DateString,
	inflation: number,
	periodEnd: DateString,
): bigint {
	switch (measure.op) {
		case "const":
			return oracleConstValue(measure, date, inflation, periodEnd)
		case "tally":
			return tallies[measure.basis]?.get(measure.label) ?? 0n
		case "scale":
			return oracleDivide(
				get(measure.of) * BigInt(measure.num),
				BigInt(measure.den),
				measure.rounding,
			)
		case "mul":
			return oracleDivide(get(measure.a) * get(measure.b), BigInt(measure.den), measure.rounding)
		case "pick":
			return get(measure.a) > get(measure.b) ? get(measure.then) : get(measure.else)
		case "add":
			return get(measure.a) + get(measure.b)
		case "sub":
			return get(measure.a) - get(measure.b)
		case "min":
			return lesser(get(measure.a), get(measure.b))
		default:
			return greater(get(measure.a), get(measure.b))
	}
}

/** Every Measure of a Levy and its `due`, evaluated by a naive recursive walk over the graph. */
export function oracleMeasures(
	levy: Levy,
	tallies: OracleTallies,
	date: DateString,
	inflation: number,
	periodEnd: DateString = date,
): OracleMeasures {
	const byId = new Map<string, LevyMeasure>()
	for (const measure of levy.measures) byId.set(measure.id, measure)
	const memo = new Map<string, bigint>()
	const get = (id: string): bigint => {
		const found = memo.get(id)
		if (found !== undefined) return found
		const measure = byId.get(id)
		if (measure === undefined) throw new Error(`No Measure ${id}`)
		const value = measureValue(measure, get, tallies, date, inflation, periodEnd)
		memo.set(id, value)
		return value
	}
	const values = new Map<string, bigint>()
	for (const measure of levy.measures) values.set(measure.id, get(measure.id))
	return { values, due: get(levy.due) }
}
