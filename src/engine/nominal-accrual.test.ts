import { describe, expect, it } from "bun:test"
import type { Account } from "../types"
import type { ProjectionRow } from "../types/projection"
import { project } from "./project"
import { contribution, expense, income } from "./test-flows"
import { makeFixture, rowAt, run } from "./test-helpers"

const savings: Account = { id: "savings", kind: "asset", rate: 1200, compounding: "monthly" }
const cash: Account = { id: "cash", kind: "asset", rate: 0 }

function splitAt(row: ProjectionRow, account: string) {
	const balance = row.balances.find((item) => item.account === account)!
	return {
		capitalised: balance.capitalised,
		accruedInterest: balance.accruedInterest,
		amount: balance.amount,
	}
}

function projecting(fixture: ReturnType<typeof makeFixture>) {
	const result = project(fixture.baseline, fixture.scenario, fixture.timeline)
	if (!result.ok) throw new Error(JSON.stringify(result.problems))
	return result.projection
}

describe("nominal monthly accrual end to end", () => {
	it("opens at the Baseline and capitalises one full month", () => {
		const projection = run({
			accounts: [savings],
			balances: { savings: 1_200_000 },
			surplus: [{ account: "savings" }],
			start: "2025-12-31",
			horizon: "2026-01-31",
		})
		expect(splitAt(rowAt(projection, "2025-12-31"), "savings")).toEqual({
			capitalised: 1_200_000,
			accruedInterest: 0,
			amount: 1_200_000,
		})
		expect(splitAt(rowAt(projection, "2026-01-31"), "savings")).toEqual({
			capitalised: 1_212_000,
			accruedInterest: 0,
			amount: 1_212_000,
		})
	})

	it("pro-rates a partial first month and shows accrued interest", () => {
		const projection = run({
			accounts: [savings],
			balances: { savings: 1_200_000 },
			surplus: [{ account: "savings" }],
			start: "2026-01-16",
			horizon: "2026-01-31",
		})
		expect(splitAt(rowAt(projection, "2026-01-16"), "savings").accruedInterest).toBe(0)
		expect(splitAt(rowAt(projection, "2026-01-20"), "savings")).toEqual({
			capitalised: 1_200_000,
			accruedInterest: 1_548,
			amount: 1_201_548,
		})
		expect(splitAt(rowAt(projection, "2026-01-31"), "savings")).toEqual({
			capitalised: 1_205_806,
			accruedInterest: 0,
			amount: 1_205_806,
		})
	})

	it("keeps a mid-period credit's numerator exact and reports the split", () => {
		const projection = run({
			accounts: [cash, savings],
			balances: { cash: 0, savings: 1_200_000 },
			flows: [
				income("bonus", 120_000, { start: "2026-01-16" }),
				contribution("save", "savings", 120_000, { start: "2026-01-16" }),
			],
			surplus: [{ account: "cash" }],
			contribute: ["savings"],
			withdraw: ["cash"],
			start: "2026-01-01",
			horizon: "2026-01-31",
		})
		expect(splitAt(rowAt(projection, "2026-01-16"), "savings")).toEqual({
			capitalised: 1_320_000,
			accruedInterest: 5_806,
			amount: 1_325_806,
		})
		expect(splitAt(rowAt(projection, "2026-01-31"), "savings")).toEqual({
			capitalised: 1_332_194,
			accruedInterest: 0,
			amount: 1_332_194,
		})
	})

	it("treats a zero nominal rate exactly like an absent compounding field", () => {
		const setup = {
			accounts: [
				{ id: "savings", kind: "asset", rate: 0, compounding: "monthly" },
				{ id: "plain", kind: "asset", rate: 0 },
			] satisfies readonly Account[],
			balances: { savings: 1_000, plain: 1_000 },
			surplus: [{ account: "savings" }],
			start: "2026-01-01",
			horizon: "2026-12-31",
		} as const
		const projection = run(setup)
		expect(splitAt(rowAt(projection, "2026-12-31"), "savings")).toEqual({
			capitalised: 1_000,
			accruedInterest: 0,
			amount: 1_000,
		})
		expect(splitAt(rowAt(projection, "2026-12-31"), "plain").amount).toBe(1_000)
	})

	it("counts leap February as twenty-eight days and capitalises on Feb 29", () => {
		const projection = run({
			accounts: [savings],
			balances: { savings: 1_200_000 },
			surplus: [{ account: "savings" }],
			start: "2024-01-31",
			horizon: "2024-02-29",
		})
		expect(splitAt(rowAt(projection, "2024-02-29"), "savings")).toEqual({
			capitalised: 1_212_000,
			accruedInterest: 0,
			amount: 1_212_000,
		})
	})

	it("reports the same balances at day and month resolution", () => {
		const setup = {
			accounts: [cash, savings],
			balances: { cash: 50_000, savings: 1_200_000 },
			flows: [
				income("pay", 30_000, { frequency: "monthly", start: "2026-01-15" }),
				expense("bill", 5_000, { frequency: "monthly", start: "2026-01-20" }),
				contribution("save", "savings", 10_000, { frequency: "monthly", start: "2026-01-15" }),
			],
			surplus: [{ account: "cash" }],
			contribute: ["savings"],
			withdraw: ["cash"],
			start: "2026-01-01",
			horizon: "2026-06-30",
		} as const
		const day = projecting(makeFixture({ ...setup, resolution: "day" }))
		const month = projecting(makeFixture({ ...setup, resolution: "month" }))
		for (const row of month.rows) {
			expect(splitAt(row, "savings")).toEqual(splitAt(rowAt(day, row.date), "savings"))
		}
	})
})
