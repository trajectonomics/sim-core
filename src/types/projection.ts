import type { ErrorCode, Path } from "../check/codes"
import type { AccountId, DateString, MinorUnits } from "./common"

export interface AccountAmount {
	readonly account: AccountId
	readonly amount: MinorUnits
}

/** One Account's value in a row: `capitalised + accruedInterest = amount`. */
export interface ProjectionBalance {
	readonly account: AccountId
	readonly amount: MinorUnits
	readonly capitalised: MinorUnits
	readonly accruedInterest: MinorUnits
}

export interface ProjectionRow {
	readonly date: DateString
	readonly balances: readonly ProjectionBalance[]
	readonly netWorth: MinorUnits
	readonly accessibleNetWorth: MinorUnits
	readonly realBalances: readonly ProjectionBalance[]
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
	readonly unfundedContributions: MinorUnits
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

export interface SettlementPeriod {
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
	readonly periods: readonly SettlementPeriod[]
}

export interface Projection {
	readonly rows: readonly ProjectionRow[]
	readonly annual: readonly AnnualRollup[]
	readonly unfundedContributions: readonly AccountAmount[]
	readonly runsOut?: RunsOut
	readonly levies?: readonly LevyReport[]
}

export interface InputProblem {
	readonly code: ErrorCode
	readonly path: Path
	/** The Occurrence date, for a problem the engine finds at run time. */
	readonly date?: DateString
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
