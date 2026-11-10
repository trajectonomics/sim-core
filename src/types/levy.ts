import type { CarryIn } from "./carry-in"
import type { BasisPoints, DateString, MinorUnits } from "./common"
import type { Measure } from "./measure"
import type { InputProblem, ValueOverflowProblem } from "./projection"

/** A recurring calendar date without a year. Never Feb 29, so it exists in every year. */
export interface MonthDay {
	readonly month: number
	readonly day: number
}

/** Totals per label, one map per basis; a label missing from a map totals 0. */
export interface Tallies {
	readonly gross: ReadonlyMap<string, MinorUnits>
	readonly funded: ReadonlyMap<string, MinorUnits>
	/** Growth accrued by Accounts under their `returnLabel`; absent means no totals. */
	readonly returns?: ReadonlyMap<string, MinorUnits>
	/** Gain realised by withdrawals under their `gainLabel`; absent means no totals. */
	readonly gains?: ReadonlyMap<string, MinorUnits>
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
	/** Required for periods that began before `Timeline.start`; see `CarryIn`. */
	readonly carryIn?: readonly CarryIn[]
}
