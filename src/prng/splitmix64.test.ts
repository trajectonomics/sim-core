import { describe, expect, it } from "bun:test"
import { oracleFirstOutput, oracleWords } from "../golden/oracle-prng"
import { PRNG_VECTORS } from "../golden/prng-cases"
import { draw32 } from "./bucket"
import { firstSplitMixOutput, nextSplitMix } from "./splitmix64"

function stream(seed: bigint, count: number): readonly bigint[] {
	const words: bigint[] = []
	let state = seed
	for (let index = 0; index < count; index++) {
		const step = nextSplitMix(state)
		state = step.state
		words.push(step.word)
	}
	return words
}

function label(seed: bigint): string {
	return seed.toString(16).padStart(16, "0")
}

describe("SplitMix64", () => {
	for (const vector of PRNG_VECTORS) {
		it(`reproduces the ADR's eight words for seed ${label(vector.seed)}`, () => {
			expect(stream(vector.seed, 8)).toEqual(vector.words)
		})

		it(`agrees with the independent oracle for seed ${label(vector.seed)}`, () => {
			expect(oracleWords(vector.seed, 8)).toEqual(vector.words)
			expect(oracleFirstOutput(vector.seed)).toBe(vector.words[0]!)
		})
	}

	it("treats a zero seed as any other state", () => {
		expect(firstSplitMixOutput(0n)).toBe(PRNG_VECTORS[0]!.words[0]!)
		expect(firstSplitMixOutput(0n)).toBe(0xe220a8397b1dcdafn)
	})

	it("gives the first draw of a stream seeded with firstSplitMixOutput", () => {
		for (const seed of [0n, 0x0123456789abcdefn, 0xffffffffffffffffn]) {
			const step = nextSplitMix(seed)
			expect(firstSplitMixOutput(seed)).toBe(step.word)
			expect(step.state).toBe(BigInt.asUintN(64, seed + 0x9e3779b97f4a7c15n))
		}
	})

	it("echoes the high 32 bits as the sampler's draw", () => {
		expect(draw32(0xe220a8397b1dcdafn)).toBe(0xe220a839)
		expect(draw32(0xffffffffffffffffn)).toBe(0xffffffff)
		expect(draw32(0x00000000ffffffffn)).toBe(0)
	})
})
