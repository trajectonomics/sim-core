import { describe, expect, it } from "bun:test"
import { contribution, expense, income } from "../engine/test-flows"
import { amounts, rowAt, run } from "../engine/test-helpers"
import type { Account } from "../types"

const cash: Account = { id: "cash", kind: "asset", rate: 1000 }

describe("projection rows", () => {
	it("reports nominal, real, net worth and accessible net worth", () => {
		const projection = run({
			accounts: [
				cash,
				{ id: "vault", kind: "asset", rate: 0, lockedUntil: "2026-06-01" },
				{ id: "debt", kind: "liability", rate: 0 },
			],
			balances: { cash: 1000, vault: 100, debt: 30 },
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			inflation: 200,
		})
		const start = rowAt(projection, "2026-01-01")
		expect(amounts(start)).toEqual({ cash: 1000, debt: 30, vault: 100 })
		expect(start.netWorth).toBe(1070)
		expect(start.accessibleNetWorth).toBe(970)
		expect(start.realNetWorth).toBe(1070)
		const end = rowAt(projection, "2027-01-01")
		expect(amounts(end)).toEqual({ cash: 1100, debt: 30, vault: 100 })
		expect(end.netWorth).toBe(1170)
		expect(end.accessibleNetWorth).toBe(1170)
		const real = Object.fromEntries(end.realBalances.map((item) => [item.account, item.amount]))
		expect(real).toEqual({ cash: 1078, debt: 29, vault: 98 })
		expect(end.realNetWorth).toBe(1147)
		expect(end.realAccessibleNetWorth).toBe(1147)
		expect(end.realNetWorth).toBe(1078 + 98 - 29)
	})

	it("keeps day and month balances identical on shared dates", () => {
		const setup = {
			accounts: [
				{ id: "cash", kind: "asset", rate: 400 },
				{ id: "savings", kind: "asset", rate: 1000 },
			] satisfies readonly Account[],
			balances: { cash: 10_000, savings: 5_000 },
			flows: [
				income("pay", 1000, { frequency: "monthly", start: "2026-01-31" }),
				expense("bill", 300, { frequency: "monthly", start: "2026-01-31" }),
				contribution("save", "savings", 200, {
					frequency: "monthly",
					start: "2026-01-31",
				}),
			],
			surplus: [{ account: "cash" }],
			contribute: ["savings"],
			withdraw: ["cash"],
			start: "2026-01-31",
			horizon: "2026-05-15",
			inflation: 250,
		} as const
		const monthly = run({ ...setup, resolution: "month" })
		expect(monthly.rows.map((row) => row.date)).toEqual([
			"2026-01-31",
			"2026-02-28",
			"2026-03-31",
			"2026-04-30",
			"2026-05-15",
		])
		const daily = run({ ...setup, resolution: "day" })
		for (const row of monthly.rows) {
			expect(daily.rows.find((item) => item.date === row.date)).toEqual(row)
		}
	})
})

describe("annual roll-ups", () => {
	it("rolls a full year up and conserves net worth", () => {
		const projection = run({
			accounts: [cash, { id: "savings", kind: "asset", rate: 0 }],
			balances: { cash: 1000, savings: 0 },
			flows: [income("pay", 100), expense("bill", 20), contribution("save", "savings", 30)],
			surplus: [{ account: "cash" }],
			contribute: ["savings"],
			withdraw: ["cash"],
			horizon: "2026-12-31",
		})
		expect(projection.annual).toEqual([
			{
				index: 0,
				from: "2026-01-01",
				to: "2026-12-31",
				openingNetWorth: 1000,
				closingNetWorth: 1185,
				income: 100,
				expense: 20,
				contributions: 30,
				unfundedContributions: 0,
				interest: 105,
				unmet: 0,
				partial: false,
			},
		])
		const year = projection.annual[0]!
		expect(year.openingNetWorth + year.income + year.interest - year.expense + year.unmet).toBe(
			year.closingNetWorth,
		)
	})

	it("splits into anchored years and lets the last one be partial", () => {
		const projection = run({
			accounts: [cash],
			balances: { cash: 1000 },
			surplus: [{ account: "cash" }],
			horizon: "2027-06-01",
		})
		expect(projection.annual.map((year) => [year.from, year.to, year.partial])).toEqual([
			["2026-01-01", "2026-12-31", false],
			["2027-01-01", "2027-06-01", true],
		])
		expect(projection.annual.map((year) => year.index)).toEqual([0, 1])
	})

	it("ends the projection on the shortfall date and marks the roll-up partial", () => {
		const projection = run({
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			balances: { cash: 100 },
			flows: [expense("bill", 150, { start: "2026-01-15" })],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2026-03-15",
			resolution: "month",
		})
		expect(projection.rows.map((row) => row.date)).toEqual(["2026-01-01", "2026-01-15"])
		expect(projection.runsOut).toEqual({ date: "2026-01-15", unmet: 50 })
		const year = projection.annual[0]!
		expect(year).toMatchObject({
			from: "2026-01-01",
			to: "2026-01-15",
			closingNetWorth: 0,
			expense: 150,
			interest: 0,
			unmet: 50,
			partial: true,
		})
		expect(year.openingNetWorth + year.income + year.interest - year.expense + year.unmet).toBe(
			year.closingNetWorth,
		)
	})
})
