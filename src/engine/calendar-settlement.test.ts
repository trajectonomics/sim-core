import { describe, expect, it } from "bun:test"
import type { Levy } from "../types"
import type { Projection } from "../types/projection"
import { income } from "./test-flows"
import {
	amounts,
	emptyCarryIn,
	type makeFixture,
	periodFrom,
	problems,
	rowAt,
	run,
	withCarryIn,
} from "./test-helpers"

type Setup = Parameters<typeof makeFixture>[0]

const next = { dayRule: "next", holidays: [] } as const
const cash = { id: "cash", kind: "asset", rate: 0 } as const

/** A calendar-year Levy settling 31 March: 2030-03-31 is a Sunday, so the 2029 period lands 2030-04-01. */
const salaryLevy: Levy = withCarryIn(
	{
		id: "salary-levy",
		period: { month: 1, day: 1 },
		settlement: { month: 3, day: 31 },
		measures: [{ id: "due", op: "tally", label: "salary", basis: "gross" }],
		due: "due",
	},
	emptyCarryIn("2025-01-01"),
)

const period2029 = {
	accounts: [cash],
	balances: { cash: 0 },
	flows: [
		income("last-day", 700, { start: "2029-12-31", label: "salary" }),
		income("after", 500, { start: "2030-04-01", label: "salary" }),
	],
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	start: "2026-01-01",
	horizon: "2030-04-10",
	levy: salaryLevy,
} as const satisfies Setup

function cashOn(projection: Projection, date: string): number {
	return amounts(rowAt(projection, date))["cash"]!
}

describe("a Settlement lands on a Business day", () => {
	it("settles the 2029 period on Monday 2030-04-01 instead of Sunday 2030-03-31", () => {
		const shifted = run({ ...period2029, calendar: next })
		expect(periodFrom(shifted, "2029-01-01")).toMatchObject({
			to: "2029-12-31",
			settlementDate: "2030-04-01",
			due: 700,
			settled: true,
		})
		// The 700 due on the period's last day is tallied, then the 700 Settlement is paid on landing.
		expect(cashOn(shifted, "2030-03-31")).toBe(700)
		expect(cashOn(shifted, "2030-04-01")).toBe(500)
	})

	it("settles a period closing 2028 on Monday 2029-04-02 instead of Saturday 2029-03-31", () => {
		const projection = run({
			...period2029,
			start: "2028-01-01",
			horizon: "2029-04-10",
			levy: withCarryIn(salaryLevy, emptyCarryIn("2027-01-01")),
			calendar: next,
		})
		expect(periodFrom(projection, "2028-01-01")).toMatchObject({
			settlementDate: "2029-04-02",
			settled: true,
		})
	})

	it("leaves the Levy output alone when no Calendar is present", () => {
		expect(periodFrom(run(period2029), "2029-01-01")).toMatchObject({
			settlementDate: "2030-03-31",
			due: 700,
			settled: true,
		})
	})

	it("reports a Settlement the horizon cut off as not settled, deducting nothing", () => {
		const capped = run({ ...period2029, horizon: "2030-03-20", calendar: next })
		expect(periodFrom(capped, "2029-01-01")).toMatchObject({
			settlementDate: "2030-04-01",
			settled: false,
		})
		expect(cashOn(capped, "2030-03-20")).toBe(700)
	})
})

describe("a constant is measured to its Due date", () => {
	const measured = (value: number, asOf: string): Levy => ({
		id: "grown",
		period: { month: 1, day: 1 },
		settlement: { month: 3, day: 31 },
		measures: [{ id: "due", op: "const", value, asOf, growth: { bps: 10_000 } }],
		due: "due",
	})

	const setup = {
		accounts: [cash],
		balances: { cash: 100_000 },
		flows: [],
		surplus: [{ account: "cash" }],
		withdraw: ["cash"],
		start: "2026-01-01",
		horizon: "2030-04-10",
		levy: withCarryIn(measured(1000, "2029-04-01"), emptyCarryIn("2025-01-01")),
	} as const satisfies Setup

	it("keeps 1000 when the shift crosses the 2029-04-01 anniversary", () => {
		const period = periodFrom(run({ ...setup, calendar: next }), "2029-01-01")
		expect(period).toMatchObject({ settlementDate: "2030-04-01", due: 1000, settlement: 1000 })
	})

	it("reports a Measure overflow on the Landed date, not the Due date", () => {
		// Starting in 2030 makes the 2029 period the first evaluated, and it grows a full year.
		const late = {
			...setup,
			start: "2030-01-01",
			levy: withCarryIn(
				measured(Number.MAX_SAFE_INTEGER, "2028-04-01"),
				emptyCarryIn("2025-01-01"),
				emptyCarryIn("2029-01-01"),
			),
		} as const
		expect(problems({ ...late, calendar: next })).toEqual([
			{ code: "VALUE_OVERFLOW", date: "2030-04-01" },
		])
	})
})

describe("Carry-in is judged on the Landed Settlement date", () => {
	/** 2030-03-31 is the Due date and 2030-04-01 the Landed one, so a start between them flips the answer. */
	const base = {
		accounts: [cash],
		balances: { cash: 0 },
		flows: [],
		surplus: [{ account: "cash" }],
		withdraw: ["cash"],
		start: "2030-04-01",
		horizon: "2030-06-30",
		levy: withCarryIn(salaryLevy, emptyCarryIn("2030-01-01")),
	} as const satisfies Setup

	it("requires the previous period's record only when the Settlement lands on the start", () => {
		expect(run(base)).toBeDefined()
		expect(problems({ ...base, calendar: next })).toEqual([
			{ code: "MISSING_CARRY_IN", path: ["scenario", "levy", "carryIn"] },
		])
		const both = withCarryIn(salaryLevy, emptyCarryIn("2029-01-01"), emptyCarryIn("2030-01-01"))
		expect(periodFrom(run({ ...base, levy: both, calendar: next }), "2029-01-01")).toMatchObject({
			settlementDate: "2030-04-01",
			settled: true,
		})
	})
})
