import type { AccountId, BasisPoints, CompoundingPeriod, DateString } from "./common"

/** Asset: `rate` is the expected return. Locked money does not count until `lockedUntil`. */
export interface AssetRule {
	readonly id: AccountId
	readonly kind: "asset"
	/** Effective annual rate, or the nominal annual rate when `compounding` is present. */
	readonly rate: BasisPoints
	readonly compounding?: CompoundingPeriod
	readonly lockedUntil?: DateString
}

/** Liability: `rate` is the interest on the outstanding balance. Cannot be locked. */
export interface LiabilityRule {
	readonly id: AccountId
	readonly kind: "liability"
	/** Effective annual rate, or the nominal annual rate when `compounding` is present. */
	readonly rate: BasisPoints
	readonly compounding?: CompoundingPeriod
}

export type Account = AssetRule | LiabilityRule
