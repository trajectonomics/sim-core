import type { AccountId, BasisPoints, DateString } from "../types"

/** One dated span return for one Account. */
export interface ReturnRow {
	readonly from: DateString
	readonly returnBps: BasisPoints
}

/** The Return rows for one Account, ascending and contiguous over a Timeline. */
export interface ReturnSeries {
	readonly account: AccountId
	readonly rows: readonly ReturnRow[]
}

/** A run input beside the Scenario: one Return series per Account. */
export interface Returns {
	readonly returnsVersion: 1
	readonly series: readonly ReturnSeries[]
}

/** A Return row with its window and day count fixed at run start. */
export interface ResolvedRow {
	readonly from: DateString
	readonly to: DateString
	readonly returnBps: BasisPoints
	readonly days: number
}

export type ResolvedSeries = readonly ResolvedRow[]

export type ResolvedReturns = ReadonlyMap<AccountId, ResolvedSeries>
