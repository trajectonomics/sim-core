import { describe, expect, it } from "bun:test"
import { DUE_2026, PREPAID_500, salaryLevySetup } from "./levy-fixture"
import { income } from "./test-flows"
import { run } from "./test-helpers"

describe("Levy in Annual roll-ups", () => {
	it("adds Prepayments and Settlements to the roll-up it falls in", () => {
		const projection = run(salaryLevySetup())
		expect(projection.annual[0]).toMatchObject({
			from: "2026-01-01",
			to: "2026-12-31",
			income: 120_000_000,
			expense: 0,
			levy: 12 * PREPAID_500,
			interest: 0,
			partial: false,
		})
		expect(projection.annual[1]).toMatchObject({
			from: "2027-01-01",
			to: "2027-03-31",
			income: 30_000_000,
			expense: 0,
			levy: 3 * PREPAID_500 + (DUE_2026 - 12 * PREPAID_500),
			interest: 0,
			partial: true,
		})
	})

	it("leaves the roll-up identity true with a Levy and a refund", () => {
		const projection = run(salaryLevySetup({ prepaymentBps: 1000 }))
		for (const year of projection.annual) {
			expect(
				year.openingNetWorth +
					year.income +
					year.interest -
					year.expense -
					(year.levy ?? 0) +
					year.unmet,
			).toBe(year.closingNetWorth)
		}
	})

	it("keeps the identity when a balance due causes a Shortfall", () => {
		const projection = run(
			salaryLevySetup({
				flows: [
					income("salary", 10_000_000, {
						frequency: "monthly",
						start: "2026-01-31",
						end: "2026-12-31",
						label: "salary",
						prepaymentBps: 500,
					}),
				],
				withdraw: [],
			}),
		)
		const year = projection.annual.at(-1)!
		expect(year).toMatchObject({ levy: 5_500_000, unmet: 5_500_000, closingNetWorth: 114_000_000 })
		expect(
			year.openingNetWorth +
				year.income +
				year.interest -
				year.expense -
				(year.levy ?? 0) +
				year.unmet,
		).toBe(year.closingNetWorth)
	})

	it("omits the Levy and the roll-up figure when the Scenario has none", () => {
		const projection = run({
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			balances: { cash: 1000 },
			surplus: [{ account: "cash" }],
			horizon: "2026-06-01",
		})
		expect(projection.levy).toBeUndefined()
		expect(projection.annual[0]).not.toHaveProperty("levy")
	})
})
