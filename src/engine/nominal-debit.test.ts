import { describe, expect, it } from "bun:test"
import type { Account } from "../types"
import { splitAt } from "./test-balance"
import { contribution, expense, income } from "./test-flows"
import { amounts, rowAt, run } from "./test-helpers"

const savings: Account = { id: "savings", kind: "asset", rate: 1200, compounding: "monthly" }
const cash: Account = { id: "cash", kind: "asset", rate: 0 }

describe("nominal debits", () => {
	it("reduces capitalised first and leaves accrued interest to capitalise", () => {
		const projection = run({
			accounts: [cash, savings],
			balances: { cash: 0, savings: 1_200_000 },
			flows: [expense("bill", 100_000, { start: "2026-01-16" })],
			surplus: [{ account: "cash" }],
			withdraw: ["savings"],
			start: "2026-01-01",
			horizon: "2026-01-31",
		})
		expect(splitAt(rowAt(projection, "2026-01-16"), "savings")).toEqual({
			capitalised: 1_100_000,
			accruedInterest: 5_806,
			amount: 1_105_806,
		})
		expect(splitAt(rowAt(projection, "2026-01-31"), "savings")).toEqual({
			capitalised: 1_111_129,
			accruedInterest: 0,
			amount: 1_111_129,
		})
		expect(amounts(rowAt(projection, "2026-01-31"))).toEqual({ cash: 0, savings: 1_111_129 })
	})

	it("capitalises before an overdrawing payment and leaves the remainder earning", () => {
		const loan: Account = { id: "loan", kind: "liability", rate: 1200, compounding: "monthly" }
		const projection = run({
			accounts: [cash, loan],
			balances: { cash: 0, loan: 1_200_000 },
			flows: [
				income("pay", 1_203_000, { start: "2026-04-16" }),
				contribution("repay", "loan", 1_203_000, { start: "2026-04-16" }),
			],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			start: "2026-04-01",
			horizon: "2026-04-30",
		})
		expect(splitAt(rowAt(projection, "2026-04-16"), "loan")).toEqual({
			capitalised: 3_000,
			accruedInterest: 0,
			amount: 3_000,
		})
		expect(splitAt(rowAt(projection, "2026-04-30"), "loan")).toEqual({
			capitalised: 3_014,
			accruedInterest: 0,
			amount: 3_014,
		})
	})

	it("clears the Account when a payment equals the value including accrued interest", () => {
		const loan: Account = { id: "loan", kind: "liability", rate: 1200, compounding: "monthly" }
		const projection = run({
			accounts: [cash, loan],
			balances: { cash: 0, loan: 1_200_000 },
			flows: [
				income("pay", 1_206_000, { start: "2026-04-16" }),
				contribution("repay", "loan", 1_206_000, { start: "2026-04-16" }),
			],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			start: "2026-04-01",
			horizon: "2026-04-30",
		})
		expect(splitAt(rowAt(projection, "2026-04-16"), "loan")).toEqual({
			capitalised: 0,
			accruedInterest: 0,
			amount: 0,
		})
	})
})
