export interface PrngVector {
	readonly seed: bigint
	readonly words: readonly bigint[]
}

/**
 * SplitMix64's first eight 64-bit outputs for two seeds. The recorded vectors were produced by
 * an independent implementation (a modulo-2^64 one) and are cross-checked by `oracle-prng.ts`.
 * The high 32 bits of each word are the sampler's draw, so a word fixes its draw too.
 */
export const PRNG_VECTORS: readonly PrngVector[] = [
	{
		seed: 0n,
		words: [
			0xe220a8397b1dcdafn,
			0x6e789e6aa1b965f4n,
			0x06c45d188009454fn,
			0xf88bb8a8724c81ecn,
			0x1b39896a51a8749bn,
			0x53cb9f0c747ea2ean,
			0x2c829abe1f4532e1n,
			0xc584133ac916ab3cn,
		],
	},
	{
		seed: 0x0123456789abcdefn,
		words: [
			0x157a3807a48faa9dn,
			0xd573529b34a1d093n,
			0x2f90b72e996dccben,
			0xa2d419334c4667ecn,
			0x01404ce914938008n,
			0x14bc574c2a2b4c72n,
			0xb8fc5b1060708c05n,
			0x8931545f4f9ea651n,
		],
	},
]

/** The first four path seeds of each recorded seed, computed from the recorded rule. */
export const PATH_SEEDS: readonly {
	readonly seed: bigint
	readonly seeds: readonly bigint[]
}[] = [
	{
		seed: 0n,
		seeds: [0xa706dd2f4d197e6fn, 0x5e41ab087439611en, 0x64684c4f0fd784b4n, 0xbccdfd9c96a18897n],
	},
	{
		seed: 0x0123456789abcdefn,
		seeds: [0x13182864bd1a9954n, 0x4a0fab93cd1a3b84n, 0x3fd33b672dcc6f2cn, 0x0abde63e2b24f505n],
	},
]
