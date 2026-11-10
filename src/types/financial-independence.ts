import type { BasisPoints, DateString, Growth, MinorUnits } from "./common"
import type { RunsOut } from "./projection"

export interface SurvivalOptions {
	readonly method: "survival"
	readonly retirementSpending?: { readonly amount: MinorUnits; readonly growth: Growth }
	readonly minBufferMonths?: number
}

export interface ProbabilityThresholdOptions {
	readonly method: "probabilityThreshold"
	readonly thresholdBps: BasisPoints
	readonly paths: number
	readonly seed: string
	readonly retirementSpending?: { readonly amount: MinorUnits; readonly growth: Growth }
	readonly minBufferMonths?: number
}

export type FinancialIndependenceOptions = SurvivalOptions | ProbabilityThresholdOptions

export interface SurvivalDefinition extends SurvivalOptions {
	readonly definitionVersion: 1
}

export interface ProbabilityDefinition {
	readonly method: "probabilityThreshold"
	readonly thresholdBps: BasisPoints
	readonly paths: number
	readonly seed: string
	readonly modelId: string
	readonly retirementSpending?: { readonly amount: MinorUnits; readonly growth: Growth }
	readonly minBufferMonths?: number
	readonly definitionVersion: 1
}

export type FinancialIndependenceDefinition = SurvivalDefinition | ProbabilityDefinition

export interface TwentyFiveTimesReference {
	readonly label: "ruleOfThumb25x"
	readonly date: DateString
	readonly unlockedAssets: MinorUnits
	readonly annualExpenses: MinorUnits
	readonly threshold: MinorUnits
	readonly multipleBps?: BasisPoints
	readonly met: boolean
}

export type FiBestCase =
	| { readonly month: DateString; readonly runsOut: RunsOut }
	| {
			readonly month: DateString
			readonly bufferBreach: {
				readonly date: DateString
				readonly required: MinorUnits
				readonly accessible: MinorUnits
			}
	  }

/** The bindings a deterministic `survival` answer reports. */
export type SurvivalBinding =
	| "shortfallBeforeStop"
	| "undrawableMoney"
	| "insufficientMoney"
	| "minimumBuffer"

/** Every binding an FI answer may report; `thresholdNotReached` belongs to `probabilityThreshold`. */
export type FiBinding = SurvivalBinding | "thresholdNotReached"

/** The highest FI survival share a probability-threshold scan saw, and the first month that had it. */
export interface ThresholdMonth {
	readonly month: DateString
	readonly fiSurvivalBps: BasisPoints
}
