const TWO64 = 18446744073709551616n
const GAMMA = 0x9e3779b97f4a7c15n

const ROUNDS: readonly (readonly [number, bigint])[] = [
	[30, 0xbf58476d1ce4e5b9n],
	[27, 0x94d049bb133111ebn],
]

function wrap(value: bigint): bigint {
	return ((value % TWO64) + TWO64) % TWO64
}

function mix(value: bigint): bigint {
	let z = wrap(value)
	for (const [shift, multiplier] of ROUNDS) {
		z = wrap((z ^ (z >> BigInt(shift))) * multiplier)
	}
	return z ^ (z >> 31n)
}

/** The first output of a fresh sequence seeded with `seed`, written modulo 2^64. */
export function oracleFirstOutput(seed: bigint): bigint {
	return mix(wrap(seed + GAMMA))
}

/** `count` consecutive outputs of a sequence seeded with `seed`. */
export function oracleWords(seed: bigint, count: number): readonly bigint[] {
	const words: bigint[] = []
	let state = wrap(seed)
	for (let index = 0; index < count; index++) {
		state = wrap(state + GAMMA)
		words.push(mix(state))
	}
	return words
}

export function oraclePathSeed(seed: bigint, index: number): bigint {
	return oracleFirstOutput(wrap(seed ^ oracleFirstOutput(BigInt(index))))
}
