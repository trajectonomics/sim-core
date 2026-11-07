import { describe, expect, it } from "bun:test"
import type { Growth, LevyContext, Measure } from "../types"
import { evaluateMeasures } from "./evaluate"
import { CONTEXT, dueOf, levyOf, talliesOf } from "./test-levy"

const two: Measure = { id: "two", op: "const", value: 2 }
const five: Measure = { id: "five", op: "const", value: 5 }
const neg: Measure = { id: "neg", op: "const", value: -3 }

function due(op: "add" | "sub" | "min" | "max", a: string, b: string): number | undefined {
	const result = dueOf([two, five, neg, { id: "r", op, a, b }], "r")
	return result.ok ? result.due : undefined
}

describe("evaluateMeasures operations", () => {
	it("adds, subtracts, takes the minimum and the maximum", () => {
		expect(due("add", "two", "five")).toBe(7)
		expect(due("sub", "two", "five")).toBe(-3)
		expect(due("min", "five", "neg")).toBe(-3)
		expect(due("max", "five", "neg")).toBe(5)
	})

	it("picks then when a > b and else otherwise, including when equal", () => {
		const pick = (a: string, b: string) => {
			// biome-ignore lint/suspicious/noThenProperty: `then` is a Measure operand key, not a thenable
			const measure: Measure = { id: "r", op: "pick", a, b, then: "two", else: "five" }
			return dueOf([two, five, measure], "r")
		}
		expect(pick("five", "two")).toMatchObject({ due: 2 })
		expect(pick("two", "five")).toMatchObject({ due: 5 })
		expect(pick("two", "two")).toMatchObject({ due: 5 })
	})

	it("sums gross for income labels and funded for contribution labels separately", () => {
		const measures: Measure[] = [
			{ id: "g", op: "tally", label: "wage", basis: "gross" },
			{ id: "f", op: "tally", label: "wage", basis: "funded" },
			{ id: "r", op: "sub", a: "g", b: "f" },
		]
		const tallies = talliesOf([["wage", 900]], [["wage", 250]])
		const result = evaluateMeasures(levyOf(measures, "r"), tallies, CONTEXT)
		expect(result).toMatchObject({ ok: true, due: 650 })
	})

	it("returns every Measure value in Levy order, even when declared before its operands", () => {
		const result = dueOf([{ id: "r", op: "add", a: "two", b: "five" }, two, five], "r")
		expect(result.ok && [...result.values]).toEqual([
			["r", 7],
			["two", 2],
			["five", 5],
		])
	})
})

describe("evaluateMeasures const growth", () => {
	const grown = (value: number, asOf: string, date: string, growth: Growth) => {
		const measure: Measure = { id: "c", op: "const", value, asOf, growth }
		const context: LevyContext = { date, inflation: 250 }
		const result = evaluateMeasures(levyOf([measure], "c"), talliesOf(), context)
		return result.ok ? result.due : undefined
	}

	it("grows by whole annual steps from asOf", () => {
		expect(grown(1_000_000, "2025-06-15", "2028-06-14", { bps: 500 })).toBe(1_102_500)
		expect(grown(1_000_000, "2025-06-15", "2028-06-15", { bps: 500 })).toBe(1_157_625)
	})

	it("follows inflation from the context", () => {
		expect(grown(1_000_000, "2025-06-15", "2026-06-15", "inflation")).toBe(1_025_000)
	})

	it("does not shrink a constant for a date before asOf", () => {
		expect(grown(1_000_000, "2025-06-15", "2024-01-01", { bps: 500 })).toBe(1_000_000)
	})

	it("grows a negative constant away from zero", () => {
		expect(grown(-1_000_000, "2025-06-15", "2027-06-15", { bps: 500 })).toBe(-1_102_500)
	})

	it("leaves a constant without growth unchanged", () => {
		const result = dueOf([{ id: "c", op: "const", value: 7, asOf: "2020-01-01" }], "c")
		expect(result).toMatchObject({ ok: true, due: 7 })
	})
})

describe("evaluateMeasures overflow", () => {
	it("reports VALUE_OVERFLOW at the context date instead of an unsafe number", () => {
		const big: Measure = { id: "big", op: "const", value: Number.MAX_SAFE_INTEGER }
		const result = dueOf([big, { id: "r", op: "add", a: "big", b: "big" }], "r")
		expect(result).toEqual({ ok: false, problem: { code: "VALUE_OVERFLOW", date: "2030-01-01" } })
	})

	it("accepts the largest safe value and rejects one beyond it, negative too", () => {
		const big: Measure = { id: "big", op: "const", value: Number.MAX_SAFE_INTEGER }
		const one: Measure = { id: "one", op: "const", value: 1 }
		const sub = (a: string, b: string) => dueOf([big, one, { id: "r", op: "sub", a, b }], "r")
		expect(sub("big", "one")).toMatchObject({ ok: true, due: Number.MAX_SAFE_INTEGER - 1 })
		const low: Measure = { id: "low", op: "const", value: -Number.MAX_SAFE_INTEGER }
		const result = dueOf([low, one, { id: "r", op: "sub", a: "low", b: "one" }], "r")
		expect(result.ok).toBe(false)
	})
})

describe("evaluateMeasures tallies", () => {
	const wage: Measure = { id: "g", op: "tally", label: "wage", basis: "gross" }
	const kept: Measure = { id: "f", op: "tally", label: "kept", basis: "funded" }

	it("reports a non-integer tally at its path instead of throwing", () => {
		for (const bad of [1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 60]) {
			const result = dueOf([wage], "g", talliesOf([["wage", bad]]))
			expect(result).toEqual({
				ok: false,
				problem: { code: "NOT_SAFE_INTEGER", path: ["gross", "wage"] },
			})
		}
	})

	it("names the funded map when the funded tally is the bad one", () => {
		const result = dueOf([wage, kept], "g", talliesOf([["wage", 1]], [["kept", 0.5]]))
		expect(result).toEqual({
			ok: false,
			problem: { code: "NOT_SAFE_INTEGER", path: ["funded", "kept"] },
		})
	})

	it("ignores a bad tally that no Measure reads", () => {
		const result = dueOf(
			[wage],
			"g",
			talliesOf([
				["wage", 3],
				["other", 0.5],
			]),
		)
		expect(result).toMatchObject({ ok: true, due: 3 })
	})
})
