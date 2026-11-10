import type { MEASURE_OPS, ROUNDINGS, TALLY_BASES } from "../vocab"
import type { DateString, Growth, MinorUnits } from "./common"

export type MeasureOp = (typeof MEASURE_OPS)[number]
export type TallyBasis = (typeof TALLY_BASES)[number]
export type Rounding = (typeof ROUNDINGS)[number]

/** One dated value of a Dated constant; `value` holds until the next step. */
export interface ConstStep {
	readonly from: DateString
	readonly value: MinorUnits
}

/**
 * A fixed amount. With `growth`, it steps once per whole year after `asOf` (required then).
 * With `steps`, it takes the last value whose `from` is on or before the period's last day.
 */
export type ConstMeasure = {
	readonly id: string
	readonly op: "const"
	readonly value: MinorUnits
} & (
	| { readonly asOf?: DateString; readonly growth?: never; readonly steps?: never }
	| { readonly asOf: DateString; readonly growth: Growth; readonly steps?: never }
	| { readonly steps: readonly ConstStep[]; readonly asOf?: never; readonly growth?: never }
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

/** The planned gross amount another Flow lands on the same Landed date; 0 when it does not. */
export interface FlowMeasure {
	readonly id: string
	readonly op: "flow"
	readonly flow: string
}

export type Measure =
	| ConstMeasure
	| TallyMeasure
	| BinaryMeasure
	| ScaleMeasure
	| MulMeasure
	| PickMeasure
	| FlowMeasure

/** A Measure a Levy may hold: everything but a `flow` reference, which only a Derived amount has. */
export type LevyMeasure = Exclude<Measure, FlowMeasure>

/** A Measure a Derived amount may hold: everything but a `tally`, which only a Levy has. */
export type DeriveMeasure = Exclude<Measure, TallyMeasure>

/** A Measure graph with ids local to one Flow, and the id of the Measure that is its amount. */
export interface Derive {
	readonly measures: readonly DeriveMeasure[]
	readonly result: string
}
