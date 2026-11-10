import { describe, expect, it } from "bun:test"
import { expected } from "../testing"
import { levyProblems } from "./levy-fixture"

/** `LEVY.measures[1]` is the `cap` const; index 2 is the `share` scale. */
const constAt = 1

function withSteps(steps: unknown, extra: Readonly<Record<string, unknown>> = {}) {
	return levyProblems([
		["measures", constAt],
		{ id: "cap", op: "const", value: 100, steps, ...extra },
	])
}

const measure = (index: number, ...rest: readonly (string | number)[]) =>
	["scenario", "levies", 0, "measures", index, ...rest] as const

/** Path inside the const's `steps`; `-1` names the list itself. */
const at = (index: number, key?: string) =>
	measure(constAt, "steps", ...(index === -1 ? [] : [index, ...(key === undefined ? [] : [key])]))

describe("check() Dated constants", () => {
	it("accepts an ascending list of dated values", () => {
		expect(withSteps([{ from: "2026-01-01", value: 100 }])).toEqual([])
		expect(
			withSteps([
				{ from: "2026-01-01", value: 100 },
				{ from: "2026-07-01", value: 200 },
			]),
		).toEqual([])
	})

	it("rejects an empty list", () => {
		expect(withSteps([])).toEqual([{ code: "MISSING_KEY", path: at(-1) }])
	})

	it("rejects asOf and growth beside steps", () => {
		expect(withSteps([{ from: "2026-01-01", value: 1 }], { asOf: "2026-01-01" })).toEqual([
			{ code: "FIELD_NOT_ALLOWED", path: measure(constAt, "asOf") },
		])
		expect(
			withSteps([{ from: "2026-01-01", value: 1 }], {
				asOf: "2026-01-01",
				growth: { bps: 100 },
			}),
		).toEqual([
			{ code: "FIELD_NOT_ALLOWED", path: measure(constAt, "asOf") },
			{ code: "FIELD_NOT_ALLOWED", path: measure(constAt, "growth") },
		])
	})

	it("rejects a date that does not rise, including a duplicate", () => {
		expect(
			withSteps([
				{ from: "2026-07-01", value: 100 },
				{ from: "2026-01-01", value: 200 },
			]),
		).toEqual(expected("STEPS_NOT_ASCENDING", at(1, "from")))
		expect(
			withSteps([
				{ from: "2026-01-01", value: 100 },
				{ from: "2026-01-01", value: 200 },
			]),
		).toEqual(expected("STEPS_NOT_ASCENDING", at(1, "from")))
	})

	it("rejects an invalid date and a value that is not a safe integer", () => {
		expect(withSteps([{ from: "2026-02-30", value: 1 }])).toEqual(
			expected("INVALID_DATE", at(0, "from")),
		)
		expect(withSteps([{ from: "2026-01-01", value: 1.5 }])).toEqual(
			expected("NOT_SAFE_INTEGER", at(0, "value")),
		)
	})

	it("rejects steps on anything but a const, and unknown keys", () => {
		expect(
			levyProblems([
				["measures", 2],
				{ id: "share", op: "scale", of: "income", num: 1, den: 2, rounding: "floor", steps: [] },
			]),
		).toEqual(expected("UNKNOWN_KEY", measure(2, "steps")))
	})

	it("reports useless shapes as problems instead of throwing", () => {
		expect(withSteps(7)).toEqual(expected("NOT_AN_ARRAY", at(-1)))
		expect(withSteps([7])).toEqual(expected("NOT_AN_OBJECT", at(0)))
	})
})
