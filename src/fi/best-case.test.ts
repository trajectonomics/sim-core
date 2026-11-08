import { describe, expect, it } from "bun:test"
import { expense } from "../engine/test-flows"
import { makeFixture } from "../engine/test-helpers"
import { financialIndependence } from "../index"

describe("best-case ordering", () => {
	it("prefers a buffer-only candidate over a later Shortfall", () => {
		const { baseline, scenario, timeline } = makeFixture({
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			balances: { cash: 1000 },
			flows: [
				expense("large-once", 5000, { start: "2026-01-10" }),
				expense("living", 100, { frequency: "monthly" }),
			],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2026-03-01",
		})
		expect(
			financialIndependence(baseline, scenario, timeline, {
				method: "survival",
				retirementSpending: { amount: 100, growth: { bps: 0 } },
				minBufferMonths: 10,
			}),
		).toMatchObject({
			ok: true,
			financialIndependence: {
				reachable: false,
				binding: "minimumBuffer",
				bestCase: {
					month: "2026-01-01",
					bufferBreach: { date: "2026-01-01", required: 1000, accessible: 900 },
				},
			},
		})
	})
})
