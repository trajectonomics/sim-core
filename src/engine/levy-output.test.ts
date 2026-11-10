import { describe, expect, it } from "bun:test"
import { TH_LIKE } from "../levy/th-levy"
import { salaryLevySetup } from "./levy-fixture"
import { income, prepays } from "./test-flows"
import { run } from "./test-helpers"

describe("Levy in Annual roll-ups", () => {
	it("adds Prepayments and Settlements to the roll-up it falls in", () => {
		const projection = run(salaryLevySetup())
		expect(projection.annual[0]).toMatchObject({
			from: "2026-01-01",
			to: "2026-12-31",
			openingNetWorth: 0,
			closingNetWorth: 114_000_000,
			income: 120_000_000,
			expense: 0,
			levy: 6_000_000,
			interest: 0,
			unmet: 0,
			partial: false,
		})
		expect(projection.annual[1]).toMatchObject({
			from: "2027-01-01",
			to: "2027-03-31",
			openingNetWorth: 114_000_000,
			closingNetWorth: 137_000_000,
			income: 30_000_000,
			expense: 0,
			levy: 7_000_000,
			interest: 0,
			unmet: 0,
			partial: true,
		})
	})

	it("leaves the roll-up identity true with a Levy and a refund", () => {
		const projection = run(salaryLevySetup({ prepaymentBps: 1000 }))
		expect(projection.annual[0]).toMatchObject({
			openingNetWorth: 0,
			closingNetWorth: 108_000_000,
			income: 120_000_000,
			expense: 0,
			levy: 12_000_000,
			interest: 0,
			unmet: 0,
		})
		expect(projection.annual[1]).toMatchObject({
			openingNetWorth: 108_000_000,
			closingNetWorth: 135_500_000,
			income: 30_000_000,
			expense: 0,
			levy: 2_500_000,
			interest: 0,
			unmet: 0,
		})
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
						prepayments: prepays(TH_LIKE.id, 500),
					}),
				],
				withdraw: [],
			}),
		)
		const year = projection.annual.at(-1)!
		expect(year).toMatchObject({
			openingNetWorth: 114_000_000,
			closingNetWorth: 114_000_000,
			income: 0,
			expense: 0,
			levy: 5_500_000,
			interest: 0,
			unmet: 5_500_000,
		})
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
		expect(projection.levies).toBeUndefined()
		expect(projection.annual[0]).not.toHaveProperty("levy")
	})
})
