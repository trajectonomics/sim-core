import { describe, expect, it } from "bun:test"
import { project } from "../engine/project"
import { amounts, rowAt, run } from "../engine/test-helpers"
import { freelancer } from "../fixtures/freelancer"
import type { Projection } from "../types/projection"

function projected(): Projection {
	const result = project(freelancer.baseline, freelancer.scenario, freelancer.timeline)
	if (!result.ok) throw new Error(JSON.stringify(result.problems))
	return result.projection
}

const split = (balance: { readonly capitalised: number; readonly accruedInterest: number }) => ({
	capitalised: balance.capitalised,
	accruedInterest: balance.accruedInterest,
})

describe("ProjectionBalance split", () => {
	it("names the four fields in the documented order", () => {
		const row = rowAt(projected(), "2026-01-01")
		expect(Object.keys(row.balances[0]!)).toEqual([
			"account",
			"amount",
			"capitalised",
			"accruedInterest",
		])
		expect(Object.keys(row.realBalances[0]!)).toEqual([
			"account",
			"amount",
			"capitalised",
			"accruedInterest",
		])
	})

	it("splits every effective-annual account as capitalised = amount and accrued 0", () => {
		for (const row of projected().rows) {
			for (const balance of [...row.balances, ...row.realBalances]) {
				expect(split(balance)).toEqual({
					capitalised: balance.amount,
					accruedInterest: 0,
				})
			}
		}
	})

	it("keeps amount as the total on every row", () => {
		const projection = run({
			accounts: [
				{ id: "cash", kind: "asset", rate: 400 },
				{ id: "loan", kind: "liability", rate: 700 },
			],
			balances: { cash: 10_000, loan: 3_000 },
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2027-01-01",
			inflation: 250,
		})
		for (const row of projection.rows) {
			for (const balance of [...row.balances, ...row.realBalances]) {
				expect(balance.capitalised + balance.accruedInterest).toBe(balance.amount)
			}
		}
	})

	it("keeps net worth equal to the signed sum of amounts", () => {
		const projection = projected()
		for (const row of projection.rows) {
			const signs = new Map(
				freelancer.scenario.accounts.map((account) => [account.id, account.kind]),
			)
			const total = row.balances.reduce(
				(sum, balance) =>
					sum + (signs.get(balance.account) === "liability" ? -balance.amount : balance.amount),
				0,
			)
			expect(row.netWorth).toBe(total)
			expect(amounts(row)).toBeDefined()
		}
	})
})
