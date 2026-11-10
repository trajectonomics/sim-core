import { resolveReturns } from "../engine/return-rows"
import type { ResolvedReturns, ReturnRow, Returns } from "../engine/returns"
import { type BucketTable, bucketTable, draw32, pickBucket } from "../prng/bucket"
import { pathSeed } from "../prng/path-seed"
import { nextSplitMix } from "../prng/splitmix64"
import type { DateString, ReturnModel, Timeline } from "../types"
import { MAX_MARKET_ROWS, marketRowDates } from "./rows"

/** One Market path: a bucket draw per row, one Return series per Account in the model. */
function pathReturns(
	model: ReturnModel,
	table: BucketTable,
	dates: readonly DateString[],
	seed: bigint,
	index: number,
): Returns {
	const rows: ReturnRow[][] = model.accounts.map(() => [])
	let state = pathSeed(seed, index)
	for (const from of dates) {
		const step = nextSplitMix(state)
		state = step.state
		const bucket = model.buckets[pickBucket(table, draw32(step.word))]!
		for (let account = 0; account < model.accounts.length; account++) {
			rows[account]!.push({ from, returnBps: bucket.returnsBps[account]! })
		}
	}
	return {
		returnsVersion: 1,
		series: model.accounts.map((account, position) => ({ account, rows: rows[position]! })),
	}
}

/** Every Market path of a run, resolved once against the Timeline: the draw is shared by all Accounts. */
export function marketPaths(
	model: ReturnModel,
	seed: bigint,
	paths: number,
	timeline: Timeline,
): readonly ResolvedReturns[] {
	const table = bucketTable(model.buckets.map((bucket) => bucket.weight))
	const dates = marketRowDates(timeline).slice(0, MAX_MARKET_ROWS)
	return Array.from({ length: paths }, (_unused, index) =>
		resolveReturns(pathReturns(model, table, dates, seed, index), timeline),
	)
}
