import type { BasisPoints, DateString } from "./common"
import type {
	FiBestCase,
	ProbabilityDefinition,
	SurvivalBinding,
	SurvivalDefinition,
	ThresholdMonth,
} from "./financial-independence"
import type { ProjectionProblem } from "./projection"
import type { RuleOfThumbReference } from "./reference"

export type SurvivalFinancialIndependence =
	| {
			readonly reachable: true
			readonly definition: SurvivalDefinition
			readonly month: DateString
			readonly reference: RuleOfThumbReference
	  }
	| {
			readonly reachable: false
			readonly definition: SurvivalDefinition
			readonly binding: "noCandidateMonth"
	  }
	| {
			readonly reachable: false
			readonly definition: SurvivalDefinition
			readonly binding: SurvivalBinding
			readonly bestCase: FiBestCase
	  }

export type ProbabilityFinancialIndependence =
	| {
			readonly reachable: true
			readonly definition: ProbabilityDefinition
			readonly month: DateString
			readonly fiSurvivalBps: BasisPoints
	  }
	| {
			readonly reachable: false
			readonly definition: ProbabilityDefinition
			readonly binding: "noCandidateMonth"
	  }
	| {
			readonly reachable: false
			readonly definition: ProbabilityDefinition
			readonly binding: "thresholdNotReached"
			readonly bestMonth: ThresholdMonth
	  }

export type FinancialIndependence = SurvivalFinancialIndependence | ProbabilityFinancialIndependence

export type SurvivalFinancialIndependenceResult =
	| { readonly ok: true; readonly financialIndependence: SurvivalFinancialIndependence }
	| { readonly ok: false; readonly problems: readonly ProjectionProblem[] }

export type ProbabilityFinancialIndependenceResult =
	| { readonly ok: true; readonly financialIndependence: ProbabilityFinancialIndependence }
	| { readonly ok: false; readonly problems: readonly ProjectionProblem[] }

export type FinancialIndependenceResult =
	| { readonly ok: true; readonly financialIndependence: FinancialIndependence }
	| { readonly ok: false; readonly problems: readonly ProjectionProblem[] }
