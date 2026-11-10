import type { DateString, Derive, DeriveMeasure } from "../types"
import { oracleConstValue } from "./oracle-const"
import { oracleDivide } from "./oracle-measure"

// BigInt has no Math.min or Math.max.
function oracleLesser(left: bigint, right: bigint): bigint {
	if (left < right) return left
	return right
}

function oracleGreater(left: bigint, right: bigint): bigint {
	if (left > right) return left
	return right
}

function measureValue(
	measure: DeriveMeasure,
	get: (id: string) => bigint,
	read: (flow: string) => bigint,
	date: DateString,
	inflation: number,
): bigint {
	switch (measure.op) {
		case "const":
			return oracleConstValue(measure, date, inflation)
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
			return oracleLesser(get(measure.a), get(measure.b))
		case "max":
			return oracleGreater(get(measure.a), get(measure.b))
		case "flow":
			return read(measure.flow)
		default:
			throw new Error("A Derived amount has no tally")
	}
}

/** A Derived amount from a naive memoised recursion over its own Measure graph. */
export function oracleDeriveValues(
	derive: Derive,
	read: (flow: string) => bigint,
	date: DateString,
	inflation: number,
): bigint {
	const measures = new Map<string, DeriveMeasure>()
	for (const measure of derive.measures) measures.set(measure.id, measure)
	const memo = new Map<string, bigint>()
	const get = (id: string): bigint => {
		const cached = memo.get(id)
		if (cached !== undefined) return cached
		const measure = measures.get(id)
		if (measure === undefined) throw new Error(`No Measure ${id}`)
		const value = measureValue(measure, get, read, date, inflation)
		memo.set(id, value)
		return value
	}
	return get(derive.result)
}
