import { describe, expect, it } from "bun:test"
import type { Account } from "../types"
import { splitAt } from "./test-balance"
import { contribution, expense, income } from "./test-flows"
import { problems, rowAt, run } from "./test-helpers"

const cash: Account = { id: "cash", kind: "asset", rate: 0 }
const savings: Account = { id: "savings", kind: "asset", rate: 1200, compounding: "monthly" }

describe("nominal edges", () => {
	it("fills a `upTo` ceiling to the value including accrued interest", () => {
		const projection = run({
			accounts: [cash, savings],
			balances: { cash: 0, savings: 1_200_000 },
			flows: [income("bonus", 10_000, { start: "2026-01-20" })],
			surplus: [{ account: "savings", upTo: 1_208_000 }, { account: "cash" }],
			start: "2026-01-01",
			horizon: "2026-01-31",
		})
		expect(splitAt(rowAt(projection, "2026-01-20"), "savings")).toEqual({
			capitalised: 1_200_645,
			accruedInterest: 7_355,
			amount: 1_208_000,
		})
		expect(splitAt(rowAt(projection, "2026-01-20"), "cash").amount).toBe(9_355)
		expect(splitAt(rowAt(projection, "2026-01-31"), "savings").amount).toBe(1_212_260)
	})

	it("capitalises a compounding date once across two mutations on that date", () => {
		const projection = run({
			accounts: [cash, savings],
			balances: { cash: 0, savings: 1_200_000 },
			flows: [
				income("pay", 20_000, { start: "2026-01-31" }),
				contribution("save", "savings", 10_000, { start: "2026-01-31" }),
				expense("bill", 100_000, { start: "2026-01-31" }),
			],
			surplus: [{ account: "cash" }],
			contribute: ["savings"],
			withdraw: ["savings"],
			start: "2025-12-31",
			horizon: "2026-01-31",
		})
		expect(splitAt(rowAt(projection, "2026-01-31"), "savings")).toEqual({
			capitalised: 1_132_000,
			accruedInterest: 0,
			amount: 1_132_000,
		})
	})

	it("reports the partial period when the horizon cuts one short", () => {
		const projection = run({
			accounts: [savings],
			balances: { savings: 1_200_000 },
			surplus: [{ account: "savings" }],
			start: "2025-12-31",
			horizon: "2026-01-20",
		})
		expect(splitAt(rowAt(projection, "2026-01-20"), "savings")).toEqual({
			capitalised: 1_200_000,
			accruedInterest: 7_742,
			amount: 1_207_742,
		})
	})

	it("does not capitalise when start and horizon are the same compounding date", () => {
		const projection = run({
			accounts: [savings],
			balances: { savings: 1_200_000 },
			surplus: [{ account: "savings" }],
			start: "2026-01-31",
			horizon: "2026-01-31",
		})
		expect(projection.rows).toHaveLength(1)
		expect(splitAt(projection.rows[0]!, "savings")).toEqual({
			capitalised: 1_200_000,
			accruedInterest: 0,
			amount: 1_200_000,
		})
	})

	it("does not accrue for a Flow that lands on Feb 29", () => {
		const projection = run({
			accounts: [cash, savings],
			balances: { cash: 0, savings: 1_200_000 },
			flows: [
				income("bonus", 100_000, { start: "2024-02-29" }),
				contribution("save", "savings", 100_000, { start: "2024-02-29" }),
			],
			surplus: [{ account: "cash" }],
			contribute: ["savings"],
			start: "2024-01-31",
			horizon: "2024-03-31",
		})
		expect(splitAt(rowAt(projection, "2024-02-29"), "savings")).toEqual({
			capitalised: 1_312_000,
			accruedInterest: 0,
			amount: 1_312_000,
		})
		expect(splitAt(rowAt(projection, "2024-03-31"), "savings").amount).toBe(1_325_120)
	})

	it("projects at both ends of the supported calendar", () => {
		for (const [start, horizon] of [
			["0001-01-01", "0001-03-31"],
			["9998-01-01", "9998-12-31"],
		] as const) {
			const projection = run({
				accounts: [savings],
				balances: { savings: 1_000 },
				surplus: [{ account: "savings" }],
				start,
				horizon,
				resolution: "month",
			})
			expect(projection.rows.at(-1)?.date).toBe(horizon)
		}
	})

	it("reports a nominal overflow as data at the date and Account", () => {
		const found = problems({
			accounts: [savings],
			balances: { savings: 8_950_000_000_000_000 },
			surplus: [{ account: "savings" }],
			start: "2025-12-31",
			horizon: "2026-03-31",
			resolution: "month",
		})
		expect(found).toEqual([{ code: "VALUE_OVERFLOW", date: "2026-01-31", account: "savings" }])
	})
})
