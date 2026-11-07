import { describe, expect, it } from "bun:test"
import { dueOf, scaled } from "./test-levy"

describe("scale rounding", () => {
	it.each([
		// 7 * 1 / 2 = 3.5
		["floor", 7, 1, 2, 3],
		["halfUp", 7, 1, 2, 4],
		["ceil", 7, 1, 2, 4],
		// 7 * 1 / 3 = 2.333...
		["floor", 7, 1, 3, 2],
		["halfUp", 7, 1, 3, 2],
		["ceil", 7, 1, 3, 3],
		// 8 * 1 / 3 = 2.666...
		["halfUp", 8, 1, 3, 3],
		// exact: 6 * 1 / 3 = 2
		["floor", 6, 1, 3, 2],
		["halfUp", 6, 1, 3, 2],
		["ceil", 6, 1, 3, 2],
	] as const)("%s of %d * %d / %d for a positive value is %d", (rounding, v, n, d, want) => {
		expect(scaled(v, n, d, rounding)).toBe(want)
	})

	it.each([
		// -7 * 1 / 2 = -3.5: the tie goes away from zero
		["floor", -7, 1, 2, -4],
		["halfUp", -7, 1, 2, -4],
		["ceil", -7, 1, 2, -3],
		// -7 * 1 / 3 = -2.333...
		["floor", -7, 1, 3, -3],
		["halfUp", -7, 1, 3, -2],
		["ceil", -7, 1, 3, -2],
		// -8 * 1 / 3 = -2.666...
		["halfUp", -8, 1, 3, -3],
		// exact: -6 * 1 / 3 = -2
		["floor", -6, 1, 3, -2],
		["halfUp", -6, 1, 3, -2],
		["ceil", -6, 1, 3, -2],
	] as const)("%s of %d * %d / %d for a negative value is %d", (rounding, v, n, d, want) => {
		expect(scaled(v, n, d, rounding)).toBe(want)
	})

	it("rounds a tie away from zero when the numerator is negative", () => {
		expect(scaled(7, -1, 2, "halfUp")).toBe(-4)
		expect(scaled(5, -1, 2, "halfUp")).toBe(-3)
		expect(scaled(5, -1, 2, "floor")).toBe(-3)
		expect(scaled(5, -1, 2, "ceil")).toBe(-2)
	})

	it("rounds ties of 0.5 and 1.5 and 2.5 away from zero", () => {
		expect([1, 3, 5].map((v) => scaled(v, 1, 2, "halfUp"))).toEqual([1, 2, 3])
		expect([-1, -3, -5].map((v) => scaled(v, 1, 2, "halfUp"))).toEqual([-1, -2, -3])
	})

	it("scales a 15% rate written as 15 / 100 exactly", () => {
		expect(scaled(1_000_000, 15, 100, "halfUp")).toBe(150_000)
	})

	it("keeps precision beyond 2^53 in the product and reports only an unsafe result", () => {
		// 9_000_000_000_000_000 * 3 / 3 = 9e15 stays safe although the product is 2.7e16.
		expect(scaled(9_000_000_000_000_000, 3, 3, "floor")).toBe(9_000_000_000_000_000)
		const over = dueOf(
			[
				{ id: "x", op: "const", value: Number.MAX_SAFE_INTEGER },
				{ id: "y", op: "scale", of: "x", num: 2, den: 1, rounding: "floor" },
			],
			"y",
		)
		expect(over).toEqual({ ok: false, problem: { code: "VALUE_OVERFLOW", date: "2030-01-01" } })
	})
})
