import type { MEASURE_OPS, ROUNDINGS, TALLY_BASES } from "../vocab"
import type { BasisPoints, DateString, Growth, MinorUnits } from "./common"
import type { InputProblem, ValueOverflowProblem } from "./projection"

export type MeasureOp = (typeof MEASURE_OPS)[number]
export type TallyBasis = (typeof TALLY_BASES)[number]
export type Rounding = (typeof ROUNDINGS)[number]

/** A recurring calendar date without a year. Never Feb 29, so it exists in every year. */
export interface MonthDay {
	readonly month: number
	readonly day: number
}

/** A fixed amount. With `growth`, it steps once per whole year after `asOf` (required then). */
export type ConstMeasure = {
	readonly id: string
	readonly op: "const"
	readonly value: MinorUnits
} & (
	| { readonly asOf?: DateString; readonly growth?: never }
	| { readonly asOf: DateString; readonly growth: Growth }
)

/** Sum of the Flows carrying `label`: `gross` sums income Flows, `funded` contribution Flows. */
export interface TallyMeasure {
	readonly id: string
	readonly op: "tally"
	readonly label: string
	readonly basis: TallyBasis
}

/** `a + b`, `a - b`, `min(a, b)` or `max(a, b)`; operands are Measure ids. */
export interface BinaryMeasure {
	readonly id: string
	readonly op: "add" | "sub" | "min" | "max"
	readonly a: string
	readonly b: string
}

/** `of * num / den`, rounded as `rounding` says; `den` is at least 1. */
export interface ScaleMeasure {
	readonly id: string
	readonly op: "scale"
	readonly of: string
	readonly num: number
	readonly den: number
	readonly rounding: Rounding
}

/** `then` when `a > b`, otherwise `else`. */
export interface PickMeasure {
	readonly id: string
	readonly op: "pick"
	readonly a: string
	readonly b: string
	readonly then: string
	readonly else: string
}

export type Measure = ConstMeasure | TallyMeasure | BinaryMeasure | ScaleMeasure | PickMeasure

/** Totals per label, one map per basis; a label missing from a map totals 0. */
export interface Tallies {
	readonly gross: ReadonlyMap<string, MinorUnits>
	readonly funded: ReadonlyMap<string, MinorUnits>
}

/** `date` is where `const` growth is measured to; `inflation` resolves `"inflation"` growth. */
export interface LevyContext {
	readonly date: DateString
	readonly inflation: BasisPoints
}

/** Every Measure's value by id (in Levy order) and the `due` value, or why there is none. */
export type MeasuresResult =
	| {
			readonly ok: true
			readonly values: ReadonlyMap<string, MinorUnits>
			readonly due: MinorUnits
	  }
	| { readonly ok: false; readonly problem: ValueOverflowProblem | InputProblem }

/** Closed rule set: Settlement periods start on `period`, settle on `settlement`, owe `due`. */
export interface Levy {
	readonly id: string
	readonly period: MonthDay
	/** The first such date strictly after the period's last day. */
	readonly settlement: MonthDay
	readonly measures: readonly Measure[]
	/** Id of the Measure that is the amount owed before Prepayment. */
	readonly due: string
}
