import { describe, expect, it } from "bun:test"
import type { Levy } from "../types"
import { salaryLevySetup } from "./levy-fixture"
import { contribution, expense, income } from "./test-flows"
import { amounts, rowAt, run } from "./test-helpers"

describe("Levy Prepayment and Settlement", () => {
	it("takes twelve monthly Prepayments and settles due minus prepaid on 31 March", () => {
		// Hand calculation: 12 x 500,000 = 6,000,000 prepaid; TH_LIKE due = 11,500,000;
		// settlement = 11,500,000 - 6,000,000 = 5,500,000.
		const projection = run(salaryLevySetup())
		const levy = projection.levy!
		expect(levy.id).toBe("th-like")
		expect(levy.periods[0]).toMatchObject({
			from: "2026-01-01",
			to: "2026-12-31",
			settlementDate: "2027-03-31",
			prepaid: 6_000_000,
			due: 11_500_000,
			settlement: 5_500_000,
			settled: true,
			partial: false,
		})
		expect(levy.periods[0]?.measures.find((item) => item.id === "income")).toEqual({
			id: "income",
			value: 120_000_000,
		})
		const start = rowAt(projection, "2026-01-31")
		expect(amounts(start)).toEqual({ cash: 9_500_000 })
		const settled = rowAt(projection, "2027-03-31")
		expect(amounts(settled)).toEqual({ cash: 137_000_000 })
	})

	it("refunds an over-Prepayment through the surplus steps", () => {
		// Hand calculation: 12 x 1,000,000 = 12,000,000 prepaid; 11,500,000 due;
		// refund = 11,500,000 - 12,000,000 = -500,000.
		const projection = run(salaryLevySetup({ prepaymentBps: 1000 }))
		const period = projection.levy!.periods[0]!
		expect(period.prepaid).toBe(12_000_000)
		expect(period.settlement).toBe(-500_000)
		const settled = rowAt(projection, "2027-03-31")
		expect(amounts(settled)).toEqual({ cash: 135_500_000 })
	})

	it("drains the withdraw list for a balance due and records a Shortfall", () => {
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
		expect(projection.runsOut).toEqual({ date: "2027-03-31", unmet: 5_500_000 })
		expect(projection.levy!.periods[0]).toMatchObject({ settled: true, settlement: 5_500_000 })
	})

	it("processes a Settlement date even when no Flow lands", () => {
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
			}),
		)
		const row = rowAt(projection, "2027-03-31")
		expect(amounts(row)).toEqual({ cash: 108_500_000 })
		expect(projection.levy!.periods[0]?.settled).toBe(true)
	})
})

describe("Levy tallies", () => {
	it("uses the funded amount when a contribution is capped", () => {
		// #18 adds the Available cashflow cap for asset contributions; the funded path is the same,
		// and this case uses the cap the engine has today: a liability's amount owed.
		const levy: Levy = {
			id: "funded-levy",
			period: { month: 1, day: 1 },
			settlement: { month: 3, day: 31 },
			measures: [{ id: "saved", op: "tally", label: "fund", basis: "funded" }],
			due: "saved",
		}
		const projection = run({
			accounts: [
				{ id: "cash", kind: "asset", rate: 0 },
				{ id: "debt", kind: "liability", rate: 0 },
			],
			balances: { cash: 1000, debt: 30 },
			flows: [contribution("fund", "debt", 100, { label: "fund", start: "2026-01-02" })],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			start: "2026-01-01",
			horizon: "2027-03-31",
			levy,
		})
		expect(projection.levy!.periods[0]).toMatchObject({
			prepaid: 0,
			due: 30,
			settlement: 30,
			settled: true,
		})
		expect(amounts(rowAt(projection, "2027-03-31"))).toEqual({ cash: 940, debt: 0 })
	})

	it("sums same-date contributions before splitting the capped amount by label", () => {
		const levy: Levy = {
			id: "funded-levy",
			period: { month: 1, day: 1 },
			settlement: { month: 3, day: 31 },
			measures: [{ id: "saved", op: "tally", label: "b", basis: "funded" }],
			due: "saved",
		}
		const projection = run({
			accounts: [
				{ id: "cash", kind: "asset", rate: 0 },
				{ id: "debt", kind: "liability", rate: 0 },
			],
			balances: { cash: 1000, debt: 50 },
			flows: [
				contribution("a", "debt", 30, { label: "a", start: "2026-01-02" }),
				contribution("b", "debt", 40, { label: "b", start: "2026-01-02" }),
			],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			start: "2026-01-01",
			horizon: "2027-03-31",
			levy,
		})
		expect(projection.levy!.periods[0]).toMatchObject({ due: 20, settlement: 20, settled: true })
		expect(amounts(rowAt(projection, "2027-03-31"))).toEqual({ cash: 930, debt: 0 })
	})
})

describe("unsettled Settlement periods", () => {
	it("reports settled false when the horizon ends before Settlement", () => {
		const projection = run(salaryLevySetup({ horizon: "2026-12-31" }))
		expect(projection.levy!.periods[0]).toMatchObject({
			prepaid: 6_000_000,
			due: 11_500_000,
			settlement: 5_500_000,
			settled: false,
			partial: false,
		})
		expect(amounts(rowAt(projection, "2026-12-31"))).toEqual({ cash: 114_000_000 })
		expect(projection.annual[0]).toMatchObject({
			levy: 6_000_000,
			closingNetWorth: 114_000_000,
		})
	})

	it("reports settled false when a Shortfall ends the Projection first", () => {
		const projection = run(
			salaryLevySetup({
				flows: [
					income("salary", 10_000_000, {
						frequency: "monthly",
						start: "2026-01-31",
						label: "salary",
						prepaymentBps: 500,
					}),
					expense("bill", 100_000_000, { start: "2026-06-15" }),
				],
			}),
		)
		expect(projection.runsOut?.date).toBe("2026-06-15")
		expect(projection.levy!.periods[0]).toMatchObject({
			prepaid: 2_500_000,
			due: 1_150_000,
			settlement: -1_350_000,
			settled: false,
			partial: true,
		})
		expect(projection.annual[0]?.levy).toBe(2_500_000)
	})
})

describe("resolution", () => {
	it("gives the same Levy numbers at day and month resolution", () => {
		const daily = run(salaryLevySetup({ resolution: "day" }))
		const monthly = run(salaryLevySetup({ resolution: "month" }))
		expect(monthly.levy).toEqual(daily.levy)
		expect(monthly.annual).toEqual(daily.annual)
	})
})
