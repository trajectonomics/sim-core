import type { MEASURE_OPS, ROUNDINGS, TALLY_BASES } from "../vocab"
import type { DateString, Growth, MinorUnits } from "./common"

export type MeasureOp = (typeof MEASURE_OPS)[number]
export type TallyBasis = (typeof TALLY_BASES)[number]
export type Rounding = (typeof ROUNDINGS)[number]

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

/** `a * b / den`, rounded as `rounding` says; `den` is at least 1 and the product is exact. */
export interface MulMeasure {
	readonly id: string
	readonly op: "mul"
	readonly a: string
	readonly b: string
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

export type Measure =
	| ConstMeasure
	| TallyMeasure
	| BinaryMeasure
	| ScaleMeasure
	| MulMeasure
	| PickMeasure
