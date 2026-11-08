import type { BasisPoints, DateString, Levy } from "../types"
import type { ProjectionProblem } from "../types/projection"
import type { LevyPeriodPlan } from "./levy-plan"

export interface LevyTally {
	readonly gross: Map<string, bigint>
	readonly funded: Map<string, bigint>
	prepaid: bigint
}

export interface EngineLevyMeasure {
	readonly id: string
	readonly value: bigint
}

export interface EngineLevyPeriod {
	readonly from: DateString
	readonly to: DateString
	readonly settlementDate: DateString
	readonly measures: readonly EngineLevyMeasure[]
	readonly prepaid: bigint
	readonly due: bigint
	readonly settlement: bigint
	readonly settled: boolean
	readonly partial: boolean
}

export interface EngineLevy {
	readonly id: string
	readonly periods: readonly EngineLevyPeriod[]
}

export interface LevyTracker {
	readonly levy: Levy
	readonly inflation: BasisPoints
	readonly periods: readonly LevyPeriodPlan[]
	readonly tallies: readonly LevyTally[]
	readonly results: (EngineLevyPeriod | undefined)[]
	readonly settlementIndex: ReadonlyMap<DateString, number>
}

export interface SettlementOutcome {
	readonly settlement: bigint
	readonly problem: ProjectionProblem | undefined
}

export type LevyFinish =
	| { readonly ok: true; readonly levy: EngineLevy }
	| { readonly ok: false; readonly problem: ProjectionProblem }
