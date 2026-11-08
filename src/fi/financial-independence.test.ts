import { describe, expect, it } from "bun:test"
import { expense, income } from "../engine/test-flows"
import { makeFixture } from "../engine/test-helpers"
import { financialIndependence } from "../index"
import type { SurvivalOptions } from "../types"

function fi(setup: Parameters<typeof makeFixture>[0], options: SurvivalOptions) {
	const { baseline, scenario, timeline } = makeFixture(setup)
	return financialIndependence(baseline, scenario, timeline, options)
}

const cash = { id: "cash", kind: "asset", rate: 0 } as const

describe("financialIndependence survival", () => {
	it("returns the earliest month where stopping earned income survives", () => {
		const result = fi(
			{
				accounts: [cash],
				balances: { cash: 0 },
				flows: [
					income("pay", 100, { frequency: "monthly" }),
					expense("living", 50, { frequency: "monthly" }),
				],
				surplus: [{ account: "cash" }],
				withdraw: ["cash"],
				horizon: "2026-06-01",
			},
			{ method: "survival" },
		)
		expect(result).toMatchObject({
			ok: true,
			financialIndependence: {
				reachable: true,
				month: "2026-04-01",
				definition: { method: "survival", definitionVersion: 1 },
			},
		})
	})

	it("reports a not-reachable answer with a best case", () => {
		const result = fi(
			{
				accounts: [cash],
				balances: { cash: 0 },
				flows: [expense("living", 100, { frequency: "monthly" })],
				surplus: [{ account: "cash" }],
				withdraw: ["cash"],
				horizon: "2026-03-01",
			},
			{ method: "survival" },
		)
		expect(result).toMatchObject({
			ok: true,
			financialIndependence: {
				reachable: false,
				binding: "insufficientMoney",
				bestCase: { month: "2026-01-01", runsOut: { date: "2026-01-01", unmet: 100 } },
			},
		})
		if (!result.ok || result.financialIndependence.reachable) throw new Error("expected a failure")
		expect(result.financialIndependence).not.toHaveProperty("reference")
	})

	it("snapshots the definition instead of aliasing the options object", () => {
		const options: SurvivalOptions = {
			method: "survival",
			retirementSpending: { amount: 100, growth: { bps: 0 } },
		}
		const result = fi(
			{
				accounts: [cash],
				balances: { cash: 100 },
				surplus: [{ account: "cash" }],
				withdraw: ["cash"],
				horizon: "2026-01-01",
			},
			options,
		)
		if (!result.ok) throw new Error("expected ok")
		;(options.retirementSpending as { amount: number }).amount = 999
		expect(result.financialIndependence.definition.retirementSpending?.amount).toBe(100)
	})

	it("returns noCandidateMonth when a mid-month start and horizon share a month", () => {
		const result = fi(
			{
				accounts: [cash],
				balances: { cash: 100 },
				surplus: [{ account: "cash" }],
				withdraw: ["cash"],
				start: "2026-01-15",
				horizon: "2026-01-20",
			},
			{ method: "survival" },
		)
		expect(result).toMatchObject({
			ok: true,
			financialIndependence: { reachable: false, binding: "noCandidateMonth" },
		})
	})
})
