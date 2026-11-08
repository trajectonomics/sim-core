import { describe, expect, it } from "bun:test"
import { income } from "../engine/test-flows"
import { makeFixture } from "../engine/test-helpers"
import { financialIndependence } from "../index"

describe("retirement spending growth", () => {
	it("grows the amount from Timeline.start across anniversaries", () => {
		const { baseline, scenario, timeline } = makeFixture({
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			balances: { cash: 0 },
			flows: [income("pay", 100, { frequency: "monthly" })],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2028-01-01",
			inflation: 1000,
		})
		const result = financialIndependence(baseline, scenario, timeline, {
			method: "survival",
			retirementSpending: { amount: 200, growth: "inflation" },
		})
		expect(result).toMatchObject({
			ok: true,
			financialIndependence: {
				reachable: true,
				month: "2027-07-01",
				reference: {
					date: "2027-07-01",
					unlockedAssets: 1800,
					annualExpenses: 2772,
					threshold: 69_300,
					multipleBps: 6493,
					met: false,
				},
			},
		})
	})
})
