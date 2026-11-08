import { describe, expect, it } from "bun:test"
import type { CarryIn, Levy, Projection, SettlementPeriod } from "../types"
import { income } from "./test-flows"
import { amounts, rowAt, run } from "./test-helpers"

const empty = (periodStart: string): CarryIn => ({ periodStart, tallies: [], prepaid: 0 })

const gross = (periodStart: string, amount: number, prepaid = 0): CarryIn => ({
	periodStart,
	tallies: [{ label: "salary", basis: "gross", amount }],
	prepaid,
})

function levy(carryIn?: readonly CarryIn[]): Levy {
	return {
		id: "gross",
		period: { month: 1, day: 1 },
		settlement: { month: 3, day: 31 },
		measures: [{ id: "gross", op: "tally", label: "salary", basis: "gross" }],
		due: "gross",
		...(carryIn === undefined ? {} : { carryIn }),
	}
}

const salary = () =>
	income("salary", 10_000_000, {
		frequency: "monthly",
		start: "2026-01-31",
		label: "salary",
		prepaymentBps: 500,
	})

function periodFrom(projection: Projection, from: string): SettlementPeriod {
	const period = projection.levy?.periods.find((item) => item.from === from)
	if (period === undefined) throw new Error(`Missing Settlement period ${from}`)
	return period
}

const accounts = [{ id: "cash", kind: "asset", rate: 0 }] as const

describe("Carry-in", () => {
	it("matches a January start when June Carry-in covers January to May", () => {
		const january = run({
			accounts,
			balances: { cash: 0 },
			flows: [salary()],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			start: "2026-01-01",
			horizon: "2027-03-31",
			levy: levy([empty("2025-01-01")]),
		})
		const june = run({
			accounts,
			balances: { cash: 0 },
			flows: [salary()],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			start: "2026-06-01",
			horizon: "2027-03-31",
			levy: levy([gross("2026-01-01", 50_000_000, 2_500_000)]),
		})
		const januaryPeriod = periodFrom(january, "2026-01-01")
		const junePeriod = periodFrom(june, "2026-01-01")
		expect({
			due: junePeriod.due,
			prepaid: junePeriod.prepaid,
			settlement: junePeriod.settlement,
		}).toEqual({
			due: januaryPeriod.due,
			prepaid: januaryPeriod.prepaid,
			settlement: januaryPeriod.settlement,
		})
		expect(junePeriod).toMatchObject({
			from: "2026-01-01",
			to: "2026-12-31",
			settlementDate: "2027-03-31",
			due: 120_000_000,
			prepaid: 6_000_000,
			settlement: 114_000_000,
			settled: true,
			partial: false,
		})
	})

	it("settles an earlier period from its Carry-in alone", () => {
		const projection = run({
			accounts,
			balances: { cash: 1000 },
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			start: "2026-02-01",
			horizon: "2026-03-31",
			levy: levy([gross("2025-01-01", 1000, 100), empty("2026-01-01")]),
		})
		expect(periodFrom(projection, "2025-01-01")).toMatchObject({
			from: "2025-01-01",
			to: "2025-12-31",
			settlementDate: "2026-03-31",
			due: 1000,
			prepaid: 100,
			settlement: 900,
			settled: true,
			partial: false,
		})
		expect(amounts(rowAt(projection, "2026-03-31"))).toEqual({ cash: 100 })
	})
})
