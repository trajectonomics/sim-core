import { describe, expect, it } from "bun:test"
import { salaryLevySetup } from "./levy-fixture"
import { expense, income } from "./test-flows"
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
