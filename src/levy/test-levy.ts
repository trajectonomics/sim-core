/** TEST-ONLY builders; not imported by `src/index.ts`, so they stay out of the package. */
import type { Levy, LevyContext, Measure, MeasuresResult, MinorUnits, Tallies } from "../types"
import { evaluateMeasures } from "./evaluate"

export const CONTEXT: LevyContext = { date: "2030-01-01", inflation: 250 }

export function levyOf(measures: readonly Measure[], due: string): Levy {
	return {
		id: "test-levy",
		period: { month: 1, day: 1 },
		settlement: { month: 3, day: 31 },
		measures,
		due,
	}
}

export function talliesOf(
	gross: readonly (readonly [string, MinorUnits])[] = [],
	funded: readonly (readonly [string, MinorUnits])[] = [],
): Tallies {
	return { gross: new Map(gross), funded: new Map(funded) }
}

/** The `due` value, or the result itself when it overflowed. */
export function dueOf(
	measures: readonly Measure[],
	due: string,
	tallies: Tallies = talliesOf(),
	context: LevyContext = CONTEXT,
): MeasuresResult {
	return evaluateMeasures(levyOf(measures, due), tallies, context)
}

/** Value of a single `scale` over a constant `value`. */
export function scaled(
	value: number,
	num: number,
	den: number,
	rounding: "floor" | "halfUp" | "ceil",
): number | undefined {
	const result = dueOf(
		[
			{ id: "x", op: "const", value },
			{ id: "y", op: "scale", of: "x", num, den, rounding },
		],
		"y",
	)
	return result.ok ? result.due : undefined
}
