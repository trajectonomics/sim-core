import type { AccountId, BasisPoints, DateString, Frequency, Growth, MinorUnits } from "./common"

interface FlowBase {
	readonly id: string
	readonly amount: MinorUnits
	readonly frequency: Frequency
	readonly start: DateString
	/** Omitted means the flow runs to `Timeline.horizon`. A `once` flow omits it or equals `start`. */
	readonly end?: DateString
	readonly growth: Growth
}

export interface IncomeFlow extends FlowBase {
	readonly kind: "income"
	/** Earned (true) versus passive (false) income. */
	readonly earned: boolean
	/** Tally label a Levy sums over; without one the Flow is never tallied. Needs a Levy. */
	readonly label?: string
	/** Share of each Occurrence taken at source, 0 to 10000. Needs a Levy. */
	readonly prepaymentBps?: BasisPoints
	/** A second share, on the part of each Occurrence below a cap on the label's period-to-date gross. Needs a Levy. */
	readonly cappedPrepayment?: CappedPrepayment
}

/** `bps` of the part of gross below `upTo`, a Levy `const` Measure named by id. */
export interface CappedPrepayment {
	readonly bps: BasisPoints
	readonly upTo: string
}

export interface ExpenseFlow extends FlowBase {
	readonly kind: "expense"
}

/** Cash moves into `target`. A liability target is a debt payment capped at the amount owed; an asset target spends Available cashflow in `cashflow.contribute` order. */
export interface ContributionFlow extends FlowBase {
	readonly kind: "contribution"
	readonly target: AccountId
	/** Tally label a Levy sums over; without one the Flow is never tallied. Needs a Levy. */
	readonly label?: string
}

export type Flow = IncomeFlow | ExpenseFlow | ContributionFlow
