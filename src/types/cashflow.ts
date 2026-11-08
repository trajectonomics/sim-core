import type { AccountId, MinorUnits } from "./common"

/** One surplus step: fill `account` (up to `upTo` if given), then move to the next step. */
export interface SurplusStep {
	readonly account: AccountId
	readonly upTo?: MinorUnits
}

export interface Cashflow {
	readonly surplus: readonly SurplusStep[]
	/** Ordered funding priority for asset contributions. Every asset target must appear; extras are inert. */
	readonly contribute: readonly AccountId[]
	/** Ordered withdrawal sources; locked accounts are skipped. */
	readonly withdraw: readonly AccountId[]
}
