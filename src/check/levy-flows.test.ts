import { describe, expect, it } from "bun:test"
import { expected } from "../testing"
import { checkWith, flowsThen, flowsWith, LEVY } from "./levy-fixture"

// Thai employee flows: 0 salary (income), 2 living (expense), 3 rmf-monthly (contribution).
const at = (index: number, key: string, ...rest: readonly (string | number)[]) =>
	["scenario", "flows", index, key, ...rest] as const

const shares = (bps: unknown) => [{ levy: "levy", bps }]

/** An income Flow patch under the shared Levy, which reads its `salary` gross tally. */
const income = (change: Readonly<Record<string, unknown>>) =>
	flowsWith(0, { label: "salary", ...change })

describe("check() Flow label and prepayments", () => {
	it("accepts label and prepayments on income, and label on a contribution, with a Levy", () => {
		const flows = income({ prepayments: shares(1500) })
		expect(checkWith({ levy: LEVY, flows })).toEqual([])
		expect(checkWith({ levy: LEVY, flows: flowsThen(flows, 3, { label: "fund" }) })).toEqual([])
	})

	it("accepts a share at both ends of 0 to 10000, and an empty list", () => {
		for (const bps of [0, 10_000]) {
			expect(checkWith({ levy: LEVY, flows: income({ prepayments: shares(bps) }) })).toEqual([])
		}
		expect(checkWith({ levy: LEVY, flows: income({ prepayments: [] }) })).toEqual([])
	})

	it("rejects a share outside 0 to 10000 and fractional or non-numeric values", () => {
		const bad = (bps: unknown) =>
			checkWith({ levy: LEVY, flows: income({ prepayments: shares(bps) }) })
		expect(bad(-1)).toEqual(expected("RATE_OUT_OF_RANGE", at(0, "prepayments", 0, "bps")))
		expect(bad(10_001)).toEqual(expected("RATE_OUT_OF_RANGE", at(0, "prepayments", 0, "bps")))
		expect(bad(12.5)).toEqual(expected("NOT_SAFE_INTEGER", at(0, "prepayments", 0, "bps")))
		expect(bad("15")).toEqual(expected("NOT_SAFE_INTEGER", at(0, "prepayments", 0, "bps")))
	})

	it("rejects a label that is empty or not a string", () => {
		// A second labelled Flow keeps the Levy supplied while the salary Flow's label is broken.
		const bad = (label: unknown) =>
			checkWith({ levy: LEVY, flows: flowsThen(flowsWith(1, { label: "salary" }), 0, { label }) })
		expect(bad("")).toEqual(expected("EMPTY_STRING", at(0, "label")))
		expect(bad(7)).toEqual(expected("WRONG_TYPE", at(0, "label")))
	})

	it("rejects label and prepayments on an expense", () => {
		const expense = flowsWith(2, { label: "salary", prepayments: shares(100) })
		const flows = flowsThen(expense, 0, { label: "salary" })
		expect(checkWith({ levy: LEVY, flows })).toEqual([
			{ code: "FIELD_NOT_ALLOWED", path: at(2, "label") },
			{ code: "FIELD_NOT_ALLOWED", path: at(2, "prepayments") },
		])
	})

	it("rejects prepayments on a contribution", () => {
		const flows = flowsThen(flowsWith(3, { prepayments: shares(100) }), 0, { label: "salary" })
		expect(checkWith({ levy: LEVY, flows })).toEqual(
			expected("FIELD_NOT_ALLOWED", at(3, "prepayments")),
		)
	})

	it("rejects label and prepayments when the Scenario has no Levy", () => {
		const flows = income({ prepayments: shares(1500) })
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
			const flows = flowsThen(flowsWith(index, { tag: "x" }), 0, { label: "salary" })
			expect(checkWith({ levy: LEVY, flows })).toEqual(expected("UNKNOWN_KEY", at(index, "tag")))
		}
	})
})
