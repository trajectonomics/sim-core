import { describe, expect, it } from "bun:test"
import type { Projection } from "../types/projection"
import { contribution, income } from "./test-flows"
import { amounts, type makeFixture, rowAt, run } from "./test-helpers"

type Setup = Parameters<typeof makeFixture>[0]

function cashOn(projection: Projection, date: string): number {
	return amounts(rowAt(projection, date))["cash"]!
}

const cash = { id: "cash", kind: "asset", rate: 0 } as const
const next = { dayRule: "next", holidays: [] } as const
const base = {
	accounts: [cash],
	balances: { cash: 0 },
	surplus: [{ account: "cash" }],
} as const satisfies Setup

describe("recurrence stays anchored where it was", () => {
	it("keeps March on the 31st after February's clamped occurrence moves", () => {
		const projection = run({
			...base,
			flows: [income("pay", 100, { frequency: "monthly", start: "2026-01-31" })],
			start: "2026-01-01",
			horizon: "2026-04-30",
			calendar: next,
		})
		expect(cashOn(projection, "2026-02-01")).toBe(0)
		expect(cashOn(projection, "2026-02-02")).toBe(100)
		expect(cashOn(projection, "2026-03-01")).toBe(100)
		expect(cashOn(projection, "2026-03-02")).toBe(200)
		expect(cashOn(projection, "2026-03-30")).toBe(200)
		expect(cashOn(projection, "2026-03-31")).toBe(300)
		expect(cashOn(projection, "2026-04-30")).toBe(400)
	})

	it("does not let one shifted weekly occurrence drift the rest", () => {
		const projection = run({
			...base,
			flows: [income("pay", 100, { frequency: "weekly", start: "2026-01-02" })],
			start: "2026-01-01",
			horizon: "2026-01-23",
			calendar: { dayRule: "next", holidays: ["2026-01-09"] },
		})
		expect(cashOn(projection, "2026-01-02")).toBe(100)
		expect(cashOn(projection, "2026-01-11")).toBe(100)
		expect(cashOn(projection, "2026-01-12")).toBe(200)
		expect(cashOn(projection, "2026-01-15")).toBe(200)
		expect(cashOn(projection, "2026-01-16")).toBe(300)
		expect(cashOn(projection, "2026-01-23")).toBe(400)
	})

	it("lands all three of a daily Flow's weekend amounts on Monday", () => {
		const projection = run({
			...base,
			flows: [income("pay", 100, { frequency: "daily", start: "2026-04-24" })],
			start: "2026-04-20",
			horizon: "2026-04-27",
			calendar: next,
		})
		expect(cashOn(projection, "2026-04-24")).toBe(100)
		expect(cashOn(projection, "2026-04-26")).toBe(100)
		expect(cashOn(projection, "2026-04-27")).toBe(400)
	})

	it("keeps a Flow's amount when a shift crosses a growth anniversary", () => {
		// The anniversary is 2027-01-03; the Due date 2027-01-02 is still in year 0, so 10% must not apply.
		const projection = run({
			...base,
			flows: [
				income("pay", 1000, { frequency: "weekly", start: "2026-01-03", growth: { bps: 1000 } }),
			],
			start: "2026-12-20",
			horizon: "2027-01-05",
			calendar: { dayRule: "next", holidays: ["2027-01-02"] },
		})
		expect(cashOn(projection, "2027-01-04") - cashOn(projection, "2027-01-03")).toBe(1000)
	})
})

describe("only Landed dates are compared with the Timeline", () => {
	it("takes a Due date from just before the start that lands on it", () => {
		const projection = run({
			...base,
			flows: [income("pay", 500, { start: "2026-01-04" })],
			start: "2026-01-05",
			horizon: "2026-01-10",
			calendar: next,
		})
		expect(cashOn(projection, "2026-01-05")).toBe(500)
	})

	it("drops a Due date whose Landed date is past the horizon", () => {
		const projection = run({
			...base,
			flows: [income("pay", 500, { start: "2026-06-27" })],
			start: "2026-06-01",
			horizon: "2026-06-28",
			calendar: next,
		})
		expect(cashOn(projection, "2026-06-28")).toBe(0)
	})

	it("keeps a Due date on end whose Landed date falls after it", () => {
		const projection = run({
			...base,
			flows: [income("pay", 500, { frequency: "monthly", start: "2026-01-31", end: "2026-01-31" })],
			start: "2026-01-01",
			horizon: "2026-02-05",
			calendar: next,
		})
		expect(cashOn(projection, "2026-01-31")).toBe(0)
		expect(cashOn(projection, "2026-02-05")).toBe(500)
	})
})

describe("outcomes follow the Landed date", () => {
	it("funds a contribution that a split weekend left Unfunded", () => {
		const split = {
			accounts: [cash, { id: "savings", kind: "asset", rate: 0 }],
			balances: { cash: 0, savings: 0 },
			flows: [
				income("pay", 1000, { start: "2026-04-25" }),
				contribution("save", "savings", 500, { start: "2026-04-26" }),
			],
			start: "2026-04-20",
			horizon: "2026-04-30",
			surplus: [{ account: "cash" }],
			contribute: ["savings"],
			withdraw: ["cash"],
		} as const satisfies Setup
		expect(run(split).unfundedContributions).toEqual([{ account: "savings", amount: 500 }])
		const shifted = run({ ...split, calendar: next })
		expect(shifted.unfundedContributions).toEqual([])
		expect(amounts(rowAt(shifted, "2026-04-30"))).toEqual({ cash: 500, savings: 500 })
	})
})
