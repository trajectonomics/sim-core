import { describe, expect, it } from "bun:test"
import type { Projection } from "../types/projection"
import { expense, income } from "./test-flows"
import { amounts, type makeFixture, rowAt, run } from "./test-helpers"

type Setup = Parameters<typeof makeFixture>[0]

/** Cash the projection shows on `date`; day resolution reports a row for every date it walks. */
function cashOn(projection: Projection, date: string): number {
	return amounts(rowAt(projection, date))["cash"]!
}

const cash = { id: "cash", kind: "asset", rate: 0 } as const
const next = { dayRule: "next", holidays: [] } as const

const bill = {
	accounts: [cash],
	balances: { cash: 1000 },
	flows: [expense("bill", 300, { start: "2026-04-25" })],
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	start: "2026-04-20",
	horizon: "2026-04-30",
} as const satisfies Setup

/** Rent due Saturday 2026-04-25 and salary due Sunday 2026-04-26: 400 out before 500 in. */
const split = {
	accounts: [cash],
	balances: { cash: 0 },
	flows: [
		expense("rent", 400, { start: "2026-04-25" }),
		income("salary", 500, { start: "2026-04-26" }),
	],
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	start: "2026-04-20",
	horizon: "2026-04-30",
} as const satisfies Setup

describe("a Due date lands on a Business day", () => {
	it("moves a once expense from Saturday 2026-04-25 to Monday 2026-04-27", () => {
		const projection = run({ ...bill, calendar: next })
		expect(cashOn(projection, "2026-04-24")).toBe(1000)
		expect(cashOn(projection, "2026-04-25")).toBe(1000)
		expect(cashOn(projection, "2026-04-26")).toBe(1000)
		expect(cashOn(projection, "2026-04-27")).toBe(700)
	})

	it("removes the false Shortfall once rent and salary share Monday 2026-04-27", () => {
		expect(run(split).runsOut).toEqual({ date: "2026-04-25", unmet: 400 })
		const projection = run({ ...split, calendar: next })
		expect(projection.runsOut).toBeUndefined()
		expect(cashOn(projection, "2026-04-26")).toBe(0)
		expect(cashOn(projection, "2026-04-27")).toBe(100)
	})

	it("changes nothing for next when every Due date is already a Business day", () => {
		const weekday = { ...bill, flows: [expense("bill", 300, { start: "2026-04-24" })] }
		expect(run({ ...weekday, calendar: next })).toEqual(run(weekday))
	})

	it("keeps today's output for an absent Calendar and for exact", () => {
		const absent = run(bill)
		expect(run({ ...bill, calendar: { dayRule: "exact", holidays: [] } })).toEqual(absent)
		expect(run({ ...bill, calendar: next })).not.toEqual(absent)
		expect(cashOn(absent, "2026-04-25")).toBe(700)
	})
})

describe("a Holiday extends the shift", () => {
	it("chains across two Holidays and the weekend between them", () => {
		// Friday 2026-05-01 and Monday 2026-05-04 are closed, so nothing lands until Tuesday.
		const projection = run({
			...bill,
			flows: [expense("bill", 300, { start: "2026-05-01" })],
			start: "2026-04-27",
			horizon: "2026-05-08",
			calendar: { dayRule: "next", holidays: ["2026-05-01", "2026-05-04"] },
		})
		expect(cashOn(projection, "2026-05-04")).toBe(1000)
		expect(cashOn(projection, "2026-05-05")).toBe(700)
	})

	it("adds no extra step for a Holiday that falls on a Saturday", () => {
		const projection = run({
			...bill,
			flows: [expense("bill", 300, { start: "2026-06-06" })],
			start: "2026-06-01",
			horizon: "2026-06-12",
			calendar: { dayRule: "next", holidays: ["2026-06-06"] },
		})
		expect(cashOn(projection, "2026-06-08")).toBe(700)
	})

	it("moves a Wednesday Due date to the Thursday", () => {
		const projection = run({
			...bill,
			flows: [expense("bill", 300, { start: "2026-06-10" })],
			start: "2026-06-08",
			horizon: "2026-06-15",
			calendar: { dayRule: "next", holidays: ["2026-06-10"] },
		})
		expect(cashOn(projection, "2026-06-10")).toBe(1000)
		expect(cashOn(projection, "2026-06-11")).toBe(700)
	})

	it("projects from the first day of year 1 without hanging", () => {
		const projection = run({
			accounts: [cash],
			balances: { cash: 0 },
			flows: [income("pay", 400, { start: "0001-01-02" })],
			surplus: [{ account: "cash" }],
			start: "0001-01-01",
			horizon: "0001-01-31",
			calendar: { dayRule: "next", holidays: ["0001-01-01"] },
		})
		expect(cashOn(projection, "0001-01-02")).toBe(400)
	})
})
