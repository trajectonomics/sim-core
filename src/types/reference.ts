import type { BasisPoints, DateString, MinorUnits } from "./common"

/** Which balance counts as the reference's numerator: unlocked assets, all assets, or a net worth. */
export type ReferenceBasis = "unlockedAssets" | "allAssets" | "accessibleNetWorth" | "netWorth"

/** Which twelve months of expenses the reference divides by. */
export type ReferenceWindow = "next12Months" | "trailing12Months"

/** Nominal money, or real money in `Timeline.start` terms. */
export type ReferenceTerms = "nominal" | "real"

/** The optional, closed configuration of the rule-of-thumb reference; omitting it keeps 25×. */
export interface ReferenceOptions {
	readonly multiplier?: number
	readonly basis?: ReferenceBasis
	readonly window?: ReferenceWindow
	readonly terms?: ReferenceTerms
}

/** The informational multiple of annual expenses beside a reachable FI month; it never decides. */
export interface RuleOfThumbReference {
	readonly label: "ruleOfThumb"
	readonly date: DateString
	readonly multiplier: number
	readonly basis: ReferenceBasis
	readonly window: ReferenceWindow
	readonly terms: ReferenceTerms
	readonly unlockedAssets: MinorUnits
	readonly numerator: MinorUnits
	readonly annualExpenses: MinorUnits
	readonly threshold: MinorUnits
	readonly multipleBps?: BasisPoints
	readonly partial: boolean
	readonly met: boolean
}

/** @deprecated Use `RuleOfThumbReference`. */
export type TwentyFiveTimesReference = RuleOfThumbReference
