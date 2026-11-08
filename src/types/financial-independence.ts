import type { BasisPoints, DateString, Growth, MinorUnits } from "./common"
import type { ProjectionProblem, RunsOut } from "./projection"

export interface SurvivalOptions {
	readonly method: "survival"
	readonly retirementSpending?: { readonly amount: MinorUnits; readonly growth: Growth }
	readonly minBufferMonths?: number
}

export type FinancialIndependenceOptions = SurvivalOptions

export type FinancialIndependenceDefinition = FinancialIndependenceOptions & {
	readonly definitionVersion: 1
}

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

export type FiBinding =
	| "shortfallBeforeStop"
	| "undrawableMoney"
	| "insufficientMoney"
	| "minimumBuffer"

export type FinancialIndependence =
	| {
			readonly reachable: true
			readonly definition: FinancialIndependenceDefinition
			readonly month: DateString
			readonly reference: TwentyFiveTimesReference
	  }
	| {
			readonly reachable: false
			readonly definition: FinancialIndependenceDefinition
			readonly binding: "noCandidateMonth"
	  }
	| {
			readonly reachable: false
			readonly definition: FinancialIndependenceDefinition
			readonly binding: FiBinding
			readonly bestCase: FiBestCase
	  }

export type FinancialIndependenceResult =
	| { readonly ok: true; readonly financialIndependence: FinancialIndependence }
	| { readonly ok: false; readonly problems: readonly ProjectionProblem[] }
