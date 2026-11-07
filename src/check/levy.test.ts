import { describe, expect, it } from "bun:test"
import { expected, REMOVE } from "../testing"
import { checkWith, LEVY, levyProblems } from "./levy-fixture"

const m = (index: number, ...rest: (string | number)[]) =>
	["scenario", "levy", "measures", index, ...rest] as const

describe("check() Levy", () => {
	it("accepts a valid Levy and a scenario without one", () => {
		expect(checkWith({ levy: LEVY })).toEqual([])
		expect(checkWith({})).toEqual([])
	})

	it("rejects a Levy that is not an object, and a missing or unknown key", () => {
		expect(checkWith({ levy: 3 })).toEqual(expected("NOT_AN_OBJECT", ["scenario", "levy"]))
		expect(levyProblems([["due"], REMOVE])).toEqual(
			expected("MISSING_KEY", ["scenario", "levy", "due"]),
		)
		expect(levyProblems([["rate"], 1])).toEqual(
			expected("UNKNOWN_KEY", ["scenario", "levy", "rate"]),
		)
	})

	it("rejects an unknown key inside a Measure", () => {
		expect(levyProblems([["measures", 3, "of"], "share"])).toEqual(
			expected("UNKNOWN_KEY", m(3, "of")),
		)
	})

	it("rejects a duplicate Measure id", () => {
		expect(levyProblems([["measures", 4, "id"], "owed"])).toEqual(
			expected("DUPLICATE_ID", m(4, "id")),
		)
	})

	it("rejects a reference to an unknown Measure", () => {
		expect(levyProblems([["measures", 2, "of"], "ghost"])).toEqual(
			expected("UNKNOWN_MEASURE", m(2, "of")),
		)
		expect(levyProblems([["measures", 4, "else"], "ghost"])).toEqual(
			expected("UNKNOWN_MEASURE", m(4, "else")),
		)
	})

	it("rejects a due that is not a Measure", () => {
		expect(levyProblems([["due"], "ghost"])).toEqual(
			expected("UNKNOWN_MEASURE", ["scenario", "levy", "due"]),
		)
	})

	it("rejects a Measure that reads itself", () => {
		expect(levyProblems([["measures", 2, "of"], "share"])).toEqual(
			expected("MEASURE_CYCLE", m(2, "of")),
		)
	})

	it("rejects a longer cycle once, at the reference that closes it", () => {
		// owed reads pick, and pick reads owed (its `then`)
		expect(levyProblems([["measures", 3, "a"], "pick"])).toEqual(
			expected("MEASURE_CYCLE", m(4, "then")),
		)
	})

	it("accepts a Measure read by several others (a diamond, not a cycle)", () => {
		const both = levyProblems([["measures", 4, "b"], "income"], [["measures", 4, "a"], "income"])
		expect(both).toEqual([])
	})

	it("rejects a den below 1 and a fractional num or den", () => {
		expect(levyProblems([["measures", 2, "den"], 0])).toEqual(
			expected("INVALID_DENOMINATOR", m(2, "den")),
		)
		expect(levyProblems([["measures", 2, "den"], -2])).toEqual(
			expected("INVALID_DENOMINATOR", m(2, "den")),
		)
		expect(levyProblems([["measures", 2, "den"], 1.5])).toEqual(
			expected("NOT_SAFE_INTEGER", m(2, "den")),
		)
		expect(levyProblems([["measures", 2, "num"], 0.5])).toEqual(
			expected("NOT_SAFE_INTEGER", m(2, "num")),
		)
	})

	it("reports only INVALID_OP for an unknown op, not problems in its other keys", () => {
		expect(levyProblems([["measures", 2, "op"], "mul"], [["measures", 2, "den"], 0])).toEqual(
			expected("INVALID_OP", m(2, "op")),
		)
	})

	it("rejects an unknown op, basis and rounding", () => {
		expect(levyProblems([["measures", 0, "op"], "mul"])).toEqual(expected("INVALID_OP", m(0, "op")))
		expect(levyProblems([["measures", 0, "basis"], "net"])).toEqual(
			expected("INVALID_BASIS", m(0, "basis")),
		)
		expect(levyProblems([["measures", 2, "rounding"], "round"])).toEqual(
			expected("INVALID_ROUNDING", m(2, "rounding")),
		)
	})

	it("requires asOf when a const has growth, and validates asOf and growth", () => {
		expect(levyProblems([["measures", 1, "asOf"], REMOVE])).toEqual(
			expected("MISSING_KEY", m(1, "asOf")),
		)
		expect(levyProblems([["measures", 1, "asOf"], "2026-02-30"])).toEqual(
			expected("INVALID_DATE", m(1, "asOf")),
		)
		expect(levyProblems([["measures", 1, "growth"], "wage"])).toEqual(
			expected("INVALID_GROWTH", m(1, "growth")),
		)
	})

	it("accepts a const with neither asOf nor growth, or asOf alone", () => {
		const bare = { id: "cap", op: "const", value: -5 }
		expect(levyProblems([["measures", 1], bare])).toEqual([])
		expect(levyProblems([["measures", 1, "growth"], REMOVE])).toEqual([])
	})
})

describe("check() Levy period and settlement", () => {
	it.each(["period", "settlement"])("rejects a non-calendar %s", (key) => {
		const at = ["scenario", "levy", key] as const
		for (const bad of [
			{ month: 13, day: 1 },
			{ month: 0, day: 1 },
			{ month: 4, day: 31 },
			{ month: 2, day: 29 },
			{ month: 2, day: 30 },
			{ month: 1, day: 0 },
		]) {
			expect(levyProblems([[key], bad])).toEqual(expected("INVALID_MONTH_DAY", at))
		}
	})

	it.each(["period", "settlement"])("accepts real dates in %s, including Feb 28", (key) => {
		for (const good of [
			{ month: 2, day: 28 },
			{ month: 12, day: 31 },
			{ month: 4, day: 30 },
		]) {
			expect(levyProblems([[key], good])).toEqual([])
		}
	})

	it.each(["period", "settlement"])(
		"rejects non-integer, missing and unknown keys in %s",
		(key) => {
			const at = ["scenario", "levy", key] as const
			expect(levyProblems([[key, "month"], 1.5])).toEqual(
				expected("NOT_SAFE_INTEGER", [...at, "month"]),
			)
			expect(levyProblems([[key, "day"], REMOVE])).toEqual(expected("MISSING_KEY", [...at, "day"]))
			expect(levyProblems([[key, "year"], 2026])).toEqual(expected("UNKNOWN_KEY", [...at, "year"]))
		},
	)
})
