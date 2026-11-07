import { growthYears } from "../calendar/arith"
import { grow } from "../money/growth"
import type { BinaryMeasure, ConstMeasure, LevyContext, Measure, Tallies } from "../types"
import { scaleValue } from "./scale"

export type Lookup = (id: string) => bigint

// Math.min and Math.max do not take BigInt.
function lesser(a: bigint, b: bigint): bigint {
	if (a < b) return a
	return b
}

function greater(a: bigint, b: bigint): bigint {
	if (a > b) return a
	return b
}

const BINARY: Readonly<Record<BinaryMeasure["op"], (a: bigint, b: bigint) => bigint>> = {
	add: (a, b) => a + b,
	sub: (a, b) => a - b,
	min: lesser,
	max: greater,
}

/** A constant, grown by whole years from `asOf` to the context date (never shrunk by time). */
function constant(measure: ConstMeasure, context: LevyContext): bigint {
	const { value, asOf, growth } = measure
	if (growth === undefined || asOf === undefined) return BigInt(value)
	const rate = growth === "inflation" ? context.inflation : growth.bps
	const days = growthYears(asOf, context.date) * 365
	const grown = grow(BigInt(Math.abs(value)), rate, days)
	return value < 0 ? -grown : grown
}

/** The exact value of one Measure given the values of the Measures it reads. */
export function step(
	measure: Measure,
	get: Lookup,
	tallies: Tallies,
	context: LevyContext,
): bigint {
	switch (measure.op) {
		case "const":
			return constant(measure, context)
		case "tally":
			return BigInt(tallies[measure.basis].get(measure.label) ?? 0)
		case "scale":
			return scaleValue(get(measure.of), BigInt(measure.num), BigInt(measure.den), measure.rounding)
		case "pick":
			return get(measure.a) > get(measure.b) ? get(measure.then) : get(measure.else)
		default:
			return BINARY[measure.op](get(measure.a), get(measure.b))
	}
}
