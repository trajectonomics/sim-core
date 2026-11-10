import { describe, expect, it } from "bun:test"
import type { Edit } from "../testing"
import { expected } from "../testing"
import { levyProblems } from "./levy-fixture"

const measures: readonly unknown[] = [
	{ id: "a", op: "const", value: 7 },
	{ id: "b", op: "const", value: 5 },
	{ id: "m", op: "mul", a: "a", b: "b", den: 2, rounding: "halfUp" },
]

/** `check()` on a Levy whose only graph is `a`, `b` and one `mul`, after further edits. */
const mulProblems = (...edits: readonly Edit[]) =>
	levyProblems([["measures"], measures], [["due"], "m"], ...edits)

const at = (key: string) => ["scenario", "levy", "measures", 2, key] as const

describe("check() mul Measure op", () => {
	it("accepts a mul of two Measures with an integer denominator and a rounding", () => {
		expect(mulProblems()).toEqual([])
	})

	it("accepts every rounding", () => {
		for (const rounding of ["floor", "halfUp", "ceil"] as const) {
			expect(mulProblems([["measures", 2, "rounding"], rounding])).toEqual([])
		}
	})

	it("rejects a missing operand", () => {
		expect(
			mulProblems([["measures", 2], { id: "m", op: "mul", a: "a", den: 2, rounding: "ceil" }]),
		).toEqual(expected("MISSING_KEY", [...at("b")]))
	})

	it("rejects an operand that names no Measure", () => {
		expect(mulProblems([["measures", 2, "a"], "ghost"])).toEqual(
			expected("UNKNOWN_MEASURE", at("a")),
		)
	})

	it("rejects a denominator below 1", () => {
		expect(mulProblems([["measures", 2, "den"], 0])).toEqual(
			expected("INVALID_DENOMINATOR", at("den")),
		)
	})

	it("rejects a denominator that is not a safe integer", () => {
		expect(mulProblems([["measures", 2, "den"], 1.5])).toEqual(
			expected("NOT_SAFE_INTEGER", at("den")),
		)
	})

	it("rejects an unknown rounding", () => {
		expect(mulProblems([["measures", 2, "rounding"], "bankers"])).toEqual(
			expected("INVALID_ROUNDING", at("rounding")),
		)
	})

	it("reports a cycle through mul", () => {
		const looped = { id: "m", op: "mul", a: "m", b: "b", den: 2, rounding: "halfUp" }
		expect(mulProblems([["measures", 2], looped])).toEqual(expected("MEASURE_CYCLE", at("a")))
	})

	it("rejects an unknown key on mul", () => {
		const withKey = { id: "m", op: "mul", a: "a", b: "b", den: 2, rounding: "halfUp", num: 3 }
		expect(mulProblems([["measures", 2], withKey])).toEqual(expected("UNKNOWN_KEY", at("num")))
	})

	it("reports only INVALID_OP for a misspelt op, not problems in its other keys", () => {
		const typo = { id: "m", op: "multiply", a: "a", b: "b", den: 0, rounding: "bankers" }
		expect(mulProblems([["measures", 2], typo])).toEqual(expected("INVALID_OP", at("op")))
	})
})
