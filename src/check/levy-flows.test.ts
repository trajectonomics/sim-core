import { describe, expect, it } from "bun:test"
import { expected } from "../testing"
import { checkWith, flowsWith, LEVY } from "./levy-fixture"

// Thai employee flows: 0 salary (income), 2 living (expense), 3 rmf-monthly (contribution).
const at = (index: number, key: string, ...rest: readonly (string | number)[]) =>
	["scenario", "flows", index, key, ...rest] as const

const shares = (bps: unknown) => [{ levy: "levy", bps }]

describe("check() Flow label and prepayments", () => {
	it("accepts label and prepayments on income, and label on a contribution, with a Levy", () => {
		const flows = flowsWith(0, { label: "salary", prepayments: shares(1500) })
		expect(checkWith({ levy: LEVY, flows })).toEqual([])
		expect(checkWith({ levy: LEVY, flows: flowsWith(3, { label: "fund" }) })).toEqual([])
	})

	it("accepts a share at both ends of 0 to 10000, and an empty list", () => {
		for (const bps of [0, 10_000]) {
			expect(checkWith({ levy: LEVY, flows: flowsWith(0, { prepayments: shares(bps) }) })).toEqual(
				[],
			)
		}
		expect(checkWith({ levy: LEVY, flows: flowsWith(0, { prepayments: [] }) })).toEqual([])
	})

	it("rejects a share outside 0 to 10000 and fractional or non-numeric values", () => {
		const bad = (bps: unknown) =>
			checkWith({ levy: LEVY, flows: flowsWith(0, { prepayments: shares(bps) }) })
		expect(bad(-1)).toEqual(expected("RATE_OUT_OF_RANGE", at(0, "prepayments", 0, "bps")))
		expect(bad(10_001)).toEqual(expected("RATE_OUT_OF_RANGE", at(0, "prepayments", 0, "bps")))
		expect(bad(12.5)).toEqual(expected("NOT_SAFE_INTEGER", at(0, "prepayments", 0, "bps")))
		expect(bad("15")).toEqual(expected("NOT_SAFE_INTEGER", at(0, "prepayments", 0, "bps")))
	})

	it("rejects a label that is empty or not a string", () => {
		const bad = (label: unknown) => checkWith({ levy: LEVY, flows: flowsWith(0, { label }) })
		expect(bad("")).toEqual(expected("EMPTY_STRING", at(0, "label")))
		expect(bad(7)).toEqual(expected("WRONG_TYPE", at(0, "label")))
	})

	it("rejects label and prepayments on an expense", () => {
		const flows = flowsWith(2, { label: "salary", prepayments: shares(100) })
		expect(checkWith({ levy: LEVY, flows })).toEqual([
			{ code: "FIELD_NOT_ALLOWED", path: at(2, "label") },
			{ code: "FIELD_NOT_ALLOWED", path: at(2, "prepayments") },
		])
	})

	it("rejects prepayments on a contribution", () => {
		const flows = flowsWith(3, { prepayments: shares(100) })
		expect(checkWith({ levy: LEVY, flows })).toEqual(
			expected("FIELD_NOT_ALLOWED", at(3, "prepayments")),
		)
	})

	it("rejects label and prepayments when the Scenario has no Levy", () => {
		const flows = flowsWith(0, { label: "salary", prepayments: shares(1500) })
		expect(checkWith({ flows })).toEqual([
			{ code: "LEVY_REQUIRED", path: at(0, "label") },
			{ code: "LEVY_REQUIRED", path: at(0, "prepayments") },
		])
		expect(checkWith({ flows: flowsWith(3, { label: "fund" }) })).toEqual(
			expected("LEVY_REQUIRED", at(3, "label")),
		)
	})

	it("reports a misplaced field on an expense before the Levy requirement, once", () => {
		expect(checkWith({ flows: flowsWith(2, { label: "salary" }) })).toEqual(
			expected("FIELD_NOT_ALLOWED", at(2, "label")),
		)
	})

	it("still rejects unknown keys on every flow kind", () => {
		for (const index of [0, 2, 3]) {
			const flows = flowsWith(index, { tag: "x" })
			expect(checkWith({ levy: LEVY, flows })).toEqual(expected("UNKNOWN_KEY", at(index, "tag")))
		}
	})
})
