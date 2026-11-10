import type { AccountId, MinorUnits } from "./common"

/** Snapshot balance at `Timeline.start`. A liability's amount is the positive amount owed. */
export interface Balance {
	readonly account: AccountId
	readonly amount: MinorUnits
	/** Cost basis at `start`; required when the Account tracks gains and the amount is positive. */
	readonly basis?: MinorUnits
}

export interface Baseline {
	readonly schemaVersion: 1
	readonly balances: readonly Balance[]
}
