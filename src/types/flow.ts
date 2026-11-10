import type { AccountId, BasisPoints, DateString, Frequency, Growth, MinorUnits } from "./common"
import type { Derive } from "./measure"

/** One Levy's share of an income Occurrence, in basis points of the gross. */
export interface Prepayment {
	readonly levy: string
	readonly bps: BasisPoints
}

/** A second, Levy-capped share; `upTo` is a `const` Measure of the named Levy. */
export interface CappedPrepayment {
	readonly levy: string
	readonly bps: BasisPoints
	readonly upTo: string
}

interface FlowBase {
	readonly id: string
	readonly frequency: Frequency
	readonly start: DateString
	/** Omitted means the flow runs to `Timeline.horizon`. A `once` flow omits it or equals `start`. */
	readonly end?: DateString
}

/** A fixed amount, grown by whole annual steps from the Flow's start. */
export interface FixedAmount {
	readonly amount: MinorUnits
	readonly growth: Growth
}

/** An amount computed per Occurrence from a Measure graph over other Flows. */
export interface DerivedAmount {
	readonly derive: Derive
}

export interface IncomeRules {
	readonly kind: "income"
	/** Earned (true) versus passive (false) income. */
	readonly earned: boolean
	/** Tally label a Levy sums over; without one the Flow is never tallied. Needs a Levy. */
	readonly label?: string
	/** Shares of each Occurrence taken at source, one per Levy. Needs a Levy. */
	readonly prepayments?: readonly Prepayment[]
	/** A share on the part of each Occurrence below a cap on the label's period-to-date gross. */
	readonly cappedPrepayment?: CappedPrepayment
}

export interface ExpenseRules {
	readonly kind: "expense"
}

/** Cash moves into `target`. A liability target is a debt payment capped at the amount owed; an asset target spends Available cashflow in `cashflow.contribute` order. */
export interface ContributionRules {
	readonly kind: "contribution"
	readonly target: AccountId
	/** Tally label a Levy sums over; without one the Flow is never tallied. Needs a Levy. */
	readonly label?: string
}

export type IncomeFlow = FlowBase & IncomeRules & (FixedAmount | DerivedAmount)
export type ExpenseFlow = FlowBase & ExpenseRules & (FixedAmount | DerivedAmount)
export type ContributionFlow = FlowBase & ContributionRules & (FixedAmount | DerivedAmount)

export type Flow = IncomeFlow | ExpenseFlow | ContributionFlow

/** Whether a Flow carries a fixed `amount` rather than a `derive` graph. */
export function isFixed(flow: Flow): flow is Flow & FixedAmount {
	return "amount" in flow
}

/** Whether a Flow carries a `derive` graph rather than a fixed `amount`. */
export function isDerived(flow: Flow): flow is Flow & DerivedAmount {
	return "derive" in flow
}
