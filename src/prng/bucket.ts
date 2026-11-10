const TWO_32 = 4294967296n

export interface BucketTable {
	readonly cumulative: readonly bigint[]
	readonly total: bigint
}

/**
 * Cumulative weights and their checked total. The entry point validates first and reports
 * `INVALID_WEIGHT` or `RETURN_WEIGHT_TOTAL`, so this primitive refuses what it cannot draw from.
 */
export function bucketTable(weights: readonly number[]): BucketTable {
	if (weights.length === 0) throw new RangeError("A bucket table needs at least one bucket")
	let total = 0n
	const cumulative: bigint[] = []
	for (const weight of weights) {
		if (!Number.isSafeInteger(weight) || weight < 0) {
			throw new RangeError(`A bucket weight must be a non-negative safe integer: ${weight}`)
		}
		total += BigInt(weight)
		cumulative.push(total)
	}
	if (total !== TWO_32) throw new RangeError(`Bucket weights must total 2^32, got ${total}`)
	return { cumulative, total }
}

/** The high 32 bits of a SplitMix64 word: the best-distributed half. */
export function draw32(word: bigint): number {
	return Number(word >> 32n)
}

/** The smallest index whose cumulative weight exceeds `draw`; a zero weight is never picked. */
export function pickBucket(table: BucketTable, draw: number): number {
	let low = 0
	let high = table.cumulative.length - 1
	while (low < high) {
		const middle = Math.floor((low + high) / 2)
		if (BigInt(draw) < table.cumulative[middle]!) high = middle
		else low = middle + 1
	}
	return low
}
