import { describe, expect, it } from "bun:test"
import { contribution, income } from "../engine/test-flows"
import { run } from "../engine/test-helpers"
import type { Account } from "../types"

const accounts: readonly Account[] = [
	{ id: "cash", kind: "asset", rate: 0 },
	{ id: "savings", kind: "asset", rate: 0 },
	{ id: "other", kind: "asset", rate: 0 },
]

const base = {
	accounts,
	balances: { cash: 0, other: 0, savings: 0 },
	surplus: [{ account: "cash" }],
	contribute: ["savings", "other"],
	horizon: "2026-01-01",
} as const

describe("Projection.unfundedContributions", () => {
	it("lists the unfunded accounts sorted by id, not by funding priority", () => {
		const projection = run({
			...base,
			flows: [contribution("save-one", "savings", 80), contribution("save-two", "other", 80)],
		})
		expect(projection.unfundedContributions).toEqual([
			{ account: "other", amount: 80 },
			{ account: "savings", amount: 80 },
		])
	})

	it("is empty when every asset target is funded", () => {
		const projection = run({
			...base,
			flows: [
				income("pay", 200),
				contribution("save-one", "savings", 80),
				contribution("save-two", "other", 80),
			],
		})
		expect(projection.unfundedContributions).toEqual([])
	})
})
