import { describe, expect, it } from "bun:test"
import { oraclePathSeed } from "../golden/oracle-prng"
import { PATH_SEEDS } from "../golden/prng-cases"
import { bucketTable, draw32, pickBucket } from "./bucket"
import { pathSeed } from "./path-seed"
import { nextSplitMix } from "./splitmix64"

const BUCKETS: readonly { readonly returnsBps: number; readonly weight: number }[] = [
	{ returnsBps: 200, weight: 0x80000000 },
	{ returnsBps: -100, weight: 0x80000000 },
]

const TABLE = bucketTable(BUCKETS.map((bucket) => bucket.weight))

/** One draw per Return row from path `index`'s own sequence, which every Account shares. */
function rowsFor(seed: bigint, index: number, count: number): readonly number[] {
	let state = pathSeed(seed, index)
	const rows: number[] = []
	for (let row = 0; row < count; row++) {
		const step = nextSplitMix(state)
		state = step.state
		rows.push(BUCKETS[pickBucket(TABLE, draw32(step.word))]!.returnsBps)
	}
	return rows
}

describe("Market path seeds", () => {
	for (const recorded of PATH_SEEDS) {
		it(`reproduces the recorded path seeds for ${recorded.seed.toString(16)}`, () => {
			const found = recorded.seeds.map((_, index) => pathSeed(recorded.seed, index))
			expect(found).toEqual([...recorded.seeds])
			const oracle = recorded.seeds.map((_, index) => oraclePathSeed(recorded.seed, index))
			expect(found).toEqual(oracle)
		})
	}

	it("never collides two paths of one set", () => {
		const seeds = new Set(Array.from({ length: 100 }, (_, index) => pathSeed(0n, index)))
		expect(seeds.size).toBe(100)
	})
})

describe("prefix stability", () => {
	const seed = 0x0123456789abcdefn

	it("keeps the first ten path seeds when the set grows to 100 paths", () => {
		const ten = Array.from({ length: 10 }, (_, index) => pathSeed(seed, index))
		const hundred = Array.from({ length: 100 }, (_, index) => pathSeed(seed, index))
		expect(hundred.slice(0, 10)).toEqual(ten)
	})

	it("generates the same rows for path 3 in a 10-path and a 100-path set", () => {
		const ten = Array.from({ length: 10 }, (_, index) => rowsFor(seed, index, 24))
		const hundred = Array.from({ length: 100 }, (_, index) => rowsFor(seed, index, 24))
		expect(hundred[3]).toEqual(ten[3])
		expect(hundred.slice(0, 10)).toEqual(ten)
	})
})
