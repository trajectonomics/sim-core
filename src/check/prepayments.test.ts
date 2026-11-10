import { describe, expect, it } from "bun:test"
import { check } from "../check"
import { thaiEmployee } from "../fixtures/thai-employee"
import { expected } from "../testing"
import type { Levy } from "../types"
import { checkWith, flowsWith, LEVY } from "./levy-fixture"

const at = (index: number, ...rest: readonly (string | number)[]) =>
	["scenario", "flows", index, ...rest] as const

const shares = (...entries: readonly (string | number)[]) =>
	entries.length === 0
		? []
		: Array.from({ length: entries.length / 2 }, (_unused, i) => ({
				levy: entries[i * 2],
				bps: entries[i * 2 + 1],
			}))

const base = LEVY as Levy

function secondLevy(): Levy {
	return { ...base, id: "other", settlement: { month: 4, day: 30 } }
}

describe("check() Scenario levies", () => {
	it("accepts one or several Levies and rejects an empty list", () => {
		expect(checkWith({ levies: [base] })).toEqual([])
		expect(checkWith({ levies: [base, secondLevy()] })).toEqual([])
		expect(checkWith({ levies: [] })).toEqual(expected("MISSING_KEY", ["scenario", "levies"]))
	})

	it("rejects a duplicate Levy id", () => {
		expect(checkWith({ levies: [base, base] })).toEqual(
			expected("DUPLICATE_ID", ["scenario", "levies", 1, "id"]),
		)
	})

	it("rejects a v3 Scenario with the version problem alone", () => {
		const { baseline, scenario, timeline } = thaiEmployee
		expect(check(baseline, { ...scenario, schemaVersion: 3 }, timeline)).toEqual([
			{ code: "UNSUPPORTED_SCHEMA_VERSION", path: ["scenario", "schemaVersion"] },
		])
	})

	it("rejects the retired singular levy key", () => {
		const { baseline, scenario, timeline } = thaiEmployee
		expect(check(baseline, { ...scenario, levy: base }, timeline)).toEqual(
			expected("UNKNOWN_KEY", ["scenario", "levy"]),
		)
	})
})

describe("check() Flow prepayments", () => {
	it("accepts a share per Levy and rejects one that names no Levy", () => {
		expect(
			checkWith({
				levies: [base, secondLevy()],
				flows: flowsWith(0, { prepayments: shares("levy", 5000, "other", 5000) }),
			}),
		).toEqual([])
		expect(
			checkWith({ levies: [base], flows: flowsWith(0, { prepayments: shares("ghost", 5000) }) }),
		).toEqual(expected("UNKNOWN_LEVY", at(0, "prepayments", 0, "levy")))
	})

	it("rejects two entries for one Levy and a total above 10000 basis points", () => {
		expect(
			checkWith({
				levies: [base],
				flows: flowsWith(0, { prepayments: shares("levy", 100, "levy", 100) }),
			}),
		).toEqual(expected("DUPLICATE_ID", at(0, "prepayments", 1, "levy")))
		expect(
			checkWith({
				levies: [base, secondLevy()],
				flows: flowsWith(0, { prepayments: shares("levy", 6000, "other", 4001) }),
			}),
		).toEqual(expected("RATE_OUT_OF_RANGE", at(0, "prepayments")))
	})

	it("rejects a value that is not an array and an entry that is not an object", () => {
		expect(checkWith({ levies: [base], flows: flowsWith(0, { prepayments: 500 }) })).toEqual(
			expected("NOT_AN_ARRAY", at(0, "prepayments")),
		)
		expect(checkWith({ levies: [base], flows: flowsWith(0, { prepayments: [7] }) })).toEqual(
			expected("NOT_AN_OBJECT", at(0, "prepayments", 0)),
		)
	})

	it("rejects the retired prepaymentBps key", () => {
		expect(checkWith({ levies: [base], flows: flowsWith(0, { prepaymentBps: 500 }) })).toEqual(
			expected("UNKNOWN_KEY", at(0, "prepaymentBps")),
		)
	})
})
