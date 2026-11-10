import { describe, expect, it } from "bun:test"
import { thaiEmployee } from "../fixtures/thai-employee"
import { expected } from "../testing"
import type { Derive, DeriveMeasure } from "../types"
import { checkWith, flowsWith, LEVY } from "./levy-fixture"

const at = (index: number, ...rest: readonly (string | number)[]) =>
	["scenario", "flows", index, ...rest] as const

/** The Thai employee income Flow, with `amount` and `growth` removed and `patch` applied. */
function derived(index: number, patch: Readonly<Record<string, unknown>>): unknown[] {
	return thaiEmployee.scenario.flows.map((flow, i) => {
		if (i !== index) return flow
		const {
			amount: _amount,
			growth: _growth,
			...rest
		} = flow as unknown as Readonly<Record<string, unknown>>
		return { ...rest, ...patch }
	})
}

const basic: Derive = {
	measures: [
		{ id: "other", op: "flow", flow: "living" },
		{ id: "result", op: "scale", of: "other", num: 30, den: 100, rounding: "halfUp" },
	],
	result: "result",
}

const deriveAt = (index: number, key: string) => at(0, "derive", "measures", index, key)

describe("check() Derived Flow amounts", () => {
	it("accepts a graph over another Flow, with label, prepayments and earned", () => {
		const flows = derived(0, {
			derive: basic,
			label: "salary",
			earned: false,
			prepayments: [{ levy: "levy", bps: 500 }],
		})
		expect(checkWith({ levy: LEVY, flows })).toEqual([])
	})

	it("accepts a derived contribution with a target", () => {
		const flows = derived(3, { derive: basic })
		expect(checkWith({ levy: LEVY, flows: derived(0, { derive: basic }) })).toEqual([])
		expect(checkWith({ levy: LEVY, flows })).toEqual([])
	})

	it("requires exactly one of amount and derive", () => {
		const neither = derived(0, {})
		expect(checkWith({ levy: LEVY, flows: neither })).toEqual(
			expected("MISSING_KEY", at(0, "amount")),
		)
		const both = flowsWith(0, { derive: basic })
		expect(checkWith({ levy: LEVY, flows: both })).toEqual(
			expected("FIELD_NOT_ALLOWED", at(0, "derive")),
		)
	})

	it("rejects growth on a derived Flow", () => {
		const flows = derived(0, { derive: basic, growth: { bps: 0 } })
		expect(checkWith({ levy: LEVY, flows })).toEqual(expected("FIELD_NOT_ALLOWED", at(0, "growth")))
	})

	it("rejects an unknown result and an unknown Flow reference", () => {
		const missingResult = derived(0, { derive: { ...basic, result: "ghost" } })
		expect(checkWith({ levy: LEVY, flows: missingResult })).toEqual(
			expected("UNKNOWN_MEASURE", at(0, "derive", "result")),
		)
		const ghost: Derive = {
			measures: [{ id: "result", op: "flow", flow: "nobody" }],
			result: "result",
		}
		expect(checkWith({ levy: LEVY, flows: derived(0, { derive: ghost }) })).toEqual(
			expected("UNKNOWN_FLOW", deriveAt(0, "flow")),
		)
	})

	it("rejects a self-reference and a longer cycle", () => {
		const self: Derive = {
			measures: [{ id: "result", op: "flow", flow: "salary" }],
			result: "result",
		}
		expect(checkWith({ levy: LEVY, flows: derived(0, { derive: self }) })).toEqual(
			expected("FLOW_CYCLE", deriveAt(0, "flow")),
		)
		const first: Derive = {
			measures: [{ id: "result", op: "flow", flow: "living" }],
			result: "result",
		}
		const second: Derive = {
			measures: [{ id: "result", op: "flow", flow: "salary" }],
			result: "result",
		}
		const flows = derived(0, { derive: first }).map((flow, i) =>
			i === 2 ? derived(2, { derive: second })[2] : flow,
		)
		// The walk visits flows in order and reports the reference that closes the cycle.
		expect(checkWith({ levy: LEVY, flows })).toContainEqual({
			code: "FLOW_CYCLE",
			path: at(2, "derive", "measures", 0, "flow"),
		})
	})

	it("rejects tally in a Derived amount and flow in a Levy", () => {
		const tally = {
			measures: [{ id: "result", op: "tally", label: "salary", basis: "gross" }],
			result: "result",
		} as unknown as Derive
		expect(checkWith({ levy: LEVY, flows: derived(0, { derive: tally }) })).toEqual(
			expected("INVALID_OP", deriveAt(0, "op")),
		)
		expect(checkWith({ levy: LEVY, flows: flowsWith(0, { label: "x" }) })).toEqual([])
	})

	it("rejects a const that grows, is dated or steps inside a Derived amount", () => {
		const constWith = (extra: Readonly<Record<string, unknown>>): Derive => ({
			measures: [{ id: "result", op: "const", value: 1, ...extra } as unknown as DeriveMeasure],
			result: "result",
		})
		for (const extra of [
			{ asOf: "2026-01-01", growth: { bps: 100 } },
			{ steps: [{ from: "2026-01-01", value: 2 }] },
		]) {
			const flows = derived(0, { derive: constWith(extra) })
			expect(checkWith({ levy: LEVY, flows })).toContainEqual({
				code: "FIELD_NOT_ALLOWED",
				path: at(0, "derive", "measures", 0, Object.keys(extra)[0]!),
			})
		}
	})

	it("reports hostile shapes as problems instead of throwing", () => {
		for (const derive of [7, [], { measures: [], result: "" }, { measures: "x", result: 1 }]) {
			expect(checkWith({ levy: LEVY, flows: derived(0, { derive }) }).length).toBeGreaterThan(0)
		}
	})
})
