import type { ErrorCode, Path } from "../check/codes"
import type { AccountId, DateString, MinorUnits } from "./common"

export interface AccountAmount {
	readonly account: AccountId
	readonly amount: MinorUnits
}

export interface ProjectionRow {
	readonly date: DateString
	readonly balances: readonly AccountAmount[]
	readonly netWorth: MinorUnits
	readonly accessibleNetWorth: MinorUnits
	readonly realBalances: readonly AccountAmount[]
	readonly realNetWorth: MinorUnits
	readonly realAccessibleNetWorth: MinorUnits
}

export interface AnnualRollup {
	readonly index: number
	readonly from: DateString
	readonly to: DateString
	readonly openingNetWorth: MinorUnits
	readonly closingNetWorth: MinorUnits
	readonly income: MinorUnits
	readonly expense: MinorUnits
	readonly contributions: MinorUnits
	/** Prepayment plus Settlements net of refunds; present only when the Scenario has a Levy. */
	readonly levy?: MinorUnits
	readonly interest: MinorUnits
	readonly unmet: MinorUnits
	readonly partial: boolean
}

export interface RunsOut {
	readonly date: DateString
	readonly unmet: MinorUnits
}

export interface LevyMeasureValue {
	readonly id: string
	readonly value: MinorUnits
}

export interface LevyPeriod {
	readonly from: DateString
	readonly to: DateString
	readonly settlementDate: DateString
	readonly measures: readonly LevyMeasureValue[]
	readonly prepaid: MinorUnits
	readonly due: MinorUnits
	readonly settlement: MinorUnits
	readonly settled: boolean
	readonly partial: boolean
}

export interface LevyReport {
	readonly id: string
	readonly periods: readonly LevyPeriod[]
}

export interface Projection {
	readonly rows: readonly ProjectionRow[]
	readonly annual: readonly AnnualRollup[]
	readonly runsOut?: RunsOut
	readonly levy?: LevyReport
}

export interface InputProblem {
	readonly code: ErrorCode
	readonly path: Path
}

export interface ValueOverflowProblem {
	readonly code: "VALUE_OVERFLOW"
	readonly date: DateString
	readonly account?: AccountId
}

export type ProjectionProblem = InputProblem | ValueOverflowProblem

export type ProjectionResult =
	| { readonly ok: true; readonly projection: Projection }
	| { readonly ok: false; readonly problems: readonly ProjectionProblem[] }
