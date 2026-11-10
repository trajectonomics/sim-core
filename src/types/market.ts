import type { AccountId, BasisPoints } from "./common"

/** One month's span returns for every Account in a Return model, with an integer weight. */
export interface MarketBucket {
	/** One span return per Account in `ReturnModel.accounts`, in the same order. */
	readonly returnsBps: readonly BasisPoints[]
	/** Non-negative safe integer; the weights of a model sum to exactly 2^32. */
	readonly weight: number
}

/** A joint bucket table: weighted market months, each with one span return per Account. */
export interface ReturnModel {
	readonly id: string
	readonly accounts: readonly AccountId[]
	readonly buckets: readonly MarketBucket[]
}
