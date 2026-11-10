import { describe, expect, it } from "bun:test"
import { bucketTable, pickBucket } from "./bucket"

const FULL = 4294967295

describe("the 2^32 bucket table", () => {
	it("puts the extremes of the draw range in the first and last bucket", () => {
		const table = bucketTable([1, FULL])
		expect(pickBucket(table, 0)).toBe(0)
		expect(pickBucket(table, FULL)).toBe(1)
	})

	it("never draws a zero weight", () => {
		const table = bucketTable([0, 0x80000000, 0x80000000])
		expect(pickBucket(table, 0)).toBe(1)
		expect(pickBucket(table, 0x7fffffff)).toBe(1)
		expect(pickBucket(table, 0x80000000)).toBe(2)
	})

	it("always picks the only bucket", () => {
		const table = bucketTable([4294967296])
		for (const draw of [0, 1, 0x7fffffff, FULL]) expect(pickBucket(table, draw)).toBe(0)
	})

	it("refuses a negative or non-integer weight", () => {
		expect(() => bucketTable([-1, 4294967297])).toThrow(RangeError)
		expect(() => bucketTable([0.5, 4294967295.5])).toThrow(RangeError)
	})

	it("refuses weights that do not total 2^32", () => {
		expect(() => bucketTable([1, 1])).toThrow(RangeError)
		expect(() => bucketTable([1, 2])).toThrow(RangeError)
	})
})
