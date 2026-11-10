import { firstSplitMixOutput } from "./splitmix64"

/**
 * The seed of Market path `index`: a bijection in `index` for a fixed `seed`, so path seeds
 * never collide. Path `index`'s stream starts here and its first draw is `firstSplitMixOutput`.
 */
export function pathSeed(seed: bigint, index: number): bigint {
	const stepped = firstSplitMixOutput(BigInt(index))
	return firstSplitMixOutput(BigInt.asUintN(64, seed ^ stepped))
}
