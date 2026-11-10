import { describe, expect, it } from "bun:test"
import type { Account } from "../types"
import type { ProjectionRow } from "../types/projection"
import { contribution, expense, income } from "./test-flows"
import { rowAt, run } from "./test-helpers"

const cash: Account = { id: "cash", kind: "asset", rate: 0 }
const savings: Account = { id: "savings", kind: "asset", rate: 1200, compounding: "monthly" }

function splitAt(row: ProjectionRow, account: string) {
	const balance = row.balances.find((item) => item.account === account)!
	return {
		capitalised: balance.capitalised,
		accruedInterest: balance.accruedInterest,
		amount: balance.amount,
	}
}

const loan: Account = { id: "loan", kind: "liability", rate: 1200, compounding: "monthly" }

function payoff(start: string, date: string, amount: number) {
	return run({
		accounts: [cash, loan],
		balances: { cash: 0, loan: 1_200_000 },
		flows: [
			income("pay", amount, { start: date }),
			contribution("repay", "loan", amount, { start: date }),
		],
		surplus: [{ account: "cash" }],
		withdraw: ["cash"],
		start,
		horizon: "2026-04-30",
	})
}

describe("nominal payoff", () => {
	it("clears a Liability paid on a compounding date after capitalising the period", () => {
		const projection = payoff("2026-03-31", "2026-04-30", 1_212_000)
		expect(splitAt(rowAt(projection, "2026-04-30"), "loan")).toEqual({
			capitalised: 0,
			accruedInterest: 0,
			amount: 0,
		})
	})

	it("ends mid-period and on-date payoffs at the same zero", () => {
		const midPeriod = payoff("2026-04-01", "2026-04-16", 1_206_000)
		expect(splitAt(rowAt(midPeriod, "2026-04-16"), "loan").amount).toBe(0)
		const onDate = payoff("2026-03-31", "2026-04-30", 1_212_000)
		expect(splitAt(rowAt(onDate, "2026-04-30"), "loan").amount).toBe(0)
	})
})

describe("nominal Assets and locks", () => {
	it("keeps a locked nominal Asset out of a withdrawal until its lock date", () => {
		const locked: Account = { ...savings, lockedUntil: "2026-02-01" }
		const projection = run({
			accounts: [cash, locked],
			balances: { cash: 0, savings: 1_200_000 },
			flows: [expense("bill", 100, { start: "2026-01-16" })],
			surplus: [{ account: "cash" }],
			withdraw: ["savings"],
			start: "2026-01-01",
			horizon: "2026-02-28",
		})
		expect(projection.runsOut).toEqual({ date: "2026-01-16", unmet: 100 })
	})

	it("withdraws from a nominal Asset after the lock and leaves the accrual intact", () => {
		const locked: Account = { ...savings, lockedUntil: "2026-02-01" }
		const projection = run({
			accounts: [cash, locked],
			balances: { cash: 0, savings: 1_200_000 },
			flows: [expense("bill", 100, { start: "2026-02-02" })],
			surplus: [{ account: "cash" }],
			withdraw: ["savings"],
			start: "2026-01-01",
			horizon: "2026-02-28",
		})
		expect(projection.runsOut).toBeUndefined()
		expect(splitAt(rowAt(projection, "2026-02-02"), "savings")).toEqual({
			capitalised: 1_211_513,
			accruedInterest: 865,
			amount: 1_212_378,
		})
	})
})

describe("nominal interest deepens a Shortfall", () => {
	const setup = (account: Account) =>
		({
			accounts: [cash, account],
			balances: { cash: 0, loan: 1_000_000 },
			flows: [
				income("pay", 1_000_000, { start: "2026-01-31" }),
				contribution("repay", "loan", 1_010_000, { start: "2026-01-31" }),
			],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			start: "2025-12-31",
			horizon: "2026-01-31",
		}) as const

	it("records the higher owed amount as an unmet Shortfall", () => {
		const projection = run(setup(loan))
		expect(projection.runsOut).toEqual({ date: "2026-01-31", unmet: 10_000 })
		expect(splitAt(rowAt(projection, "2026-01-31"), "loan").amount).toBe(0)
	})

	it("has no Shortfall when the Account carries no interest", () => {
		const projection = run(setup({ id: "loan", kind: "liability", rate: 0 }))
		expect(projection.runsOut).toBeUndefined()
	})
})
