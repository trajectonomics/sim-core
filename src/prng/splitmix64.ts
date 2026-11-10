const GAMMA = 0x9e3779b97f4a7c15n

export interface SplitMixStep {
	readonly state: bigint
	readonly word: bigint
}

function mix(value: bigint): bigint {
	const first = BigInt.asUintN(64, (value ^ (value >> 30n)) * 0xbf58476d1ce4e5b9n)
	const second = BigInt.asUintN(64, (first ^ (first >> 27n)) * 0x94d049bb133111ebn)
	return second ^ (second >> 31n)
}

/** The first output of a fresh SplitMix64 stream seeded with `seed`. */
export function firstSplitMixOutput(seed: bigint): bigint {
	return mix(BigInt.asUintN(64, seed + GAMMA))
}

/** Advances the stream once; `state` and `word` are 64-bit unsigned. */
export function nextSplitMix(state: bigint): SplitMixStep {
	const next = BigInt.asUintN(64, state + GAMMA)
	return { state: next, word: mix(next) }
}
