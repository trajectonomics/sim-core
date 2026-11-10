import { describe, expect, it } from "bun:test"
import type { Measure } from "../types"
import { CONTEXT, dueOf, talliesOf } from "./test-levy"

/** `x mul y / den`, over two constants. */
function multiplied(
	x: number,
	y: number,
	den: number,
	rounding: "floor" | "halfUp" | "ceil",
): number | undefined {
	const measures: Measure[] = [
		{ id: "x", op: "const", value: x },
		{ id: "y", op: "const", value: y },
		{ id: "r", op: "mul", a: "x", b: "y", den, rounding },
	]
	const result = dueOf(measures, "r")
	return result.ok ? result.due : undefined
}

describe("mul rounding", () => {
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
	] as const)("%s of %d * %d / %d for a positive product is %d", (rounding, x, y, d, want) => {
		expect(multiplied(x, y, d, rounding)).toBe(want)
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
	] as const)("%s of %d * %d / %d for a negative product is %d", (rounding, x, y, d, want) => {
		expect(multiplied(x, y, d, rounding)).toBe(want)
	})

	it.each([
		// 1 * 1 / 2 = 0.5, and -1 * 1 / 2 = -0.5
		["floor", 0, -1],
		["halfUp", 1, -1],
		["ceil", 1, 0],
	] as const)("%s sends 0.5 to %d and -0.5 to %d", (rounding, positive, negative) => {
		expect(multiplied(1, 1, 2, rounding)).toBe(positive)
		expect(multiplied(-1, 1, 2, rounding)).toBe(negative)
	})

	it("rounds every tie half up to the result further from zero", () => {
		expect([1, 3, 5].map((x) => multiplied(x, 1, 2, "halfUp"))).toEqual([1, 2, 3])
		expect([-1, -3, -5].map((x) => multiplied(x, 1, 2, "halfUp"))).toEqual([-1, -2, -3])
	})

	it("takes a negative factor and a negative product the same way", () => {
		expect(multiplied(7, -1, 2, "halfUp")).toBe(-4)
		expect(multiplied(-7, -1, 2, "halfUp")).toBe(4)
		expect(multiplied(-7, 1, 2, "floor")).toBe(-4)
		expect(multiplied(-7, 1, 2, "ceil")).toBe(-3)
	})
})

describe("mul precision and overflow", () => {
	it("keeps the whole product exact when it exceeds 2^53 but the quotient is safe", () => {
		// 9e15 * 3 = 2.7e16, / 3 = 9e15, still a safe integer.
		expect(multiplied(9_000_000_000_000_000, 3, 3, "halfUp")).toBe(9_000_000_000_000_000)
		expect(multiplied(500_000_000_000_000, 400, 400, "halfUp")).toBe(500_000_000_000_000)
	})

	it("reports a result that is not a safe integer as VALUE_OVERFLOW at the date", () => {
		const measures: Measure[] = [
			{ id: "x", op: "const", value: 9_000_000_000_000_000 },
			{ id: "y", op: "const", value: 2 },
			{ id: "r", op: "mul", a: "x", b: "y", den: 1, rounding: "halfUp" },
		]
		expect(dueOf(measures, "r")).toEqual({
			ok: false,
			problem: { code: "VALUE_OVERFLOW", date: CONTEXT.date },
		})
	})

	it("multiplies two derived Measures, not only constants", () => {
		const measures: Measure[] = [
			{ id: "care", op: "tally", label: "care", basis: "gross" },
			{ id: "income", op: "tally", label: "salary", basis: "gross" },
			{ id: "bump", op: "scale", of: "income", num: 1, den: 100_000, rounding: "floor" },
			{ id: "rate", op: "sub", a: "ceiling", b: "bump" },
			{ id: "ceiling", op: "const", value: 1800 },
			{ id: "credit", op: "mul", a: "care", b: "rate", den: 10_000, rounding: "halfUp" },
		]
		const tallies = talliesOf([
			["care", 12_000_000],
			["salary", 120_000_000],
		])
		// rate = 1800 - 1200 = 600 bps; 12,000,000 * 600 / 10,000 = 720,000.
		const result = dueOf(measures, "credit", tallies)
		expect(result).toMatchObject({ ok: true, due: 720_000 })
	})
})
