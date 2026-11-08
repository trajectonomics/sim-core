import { describe, expect, it } from "bun:test"
import type { Account } from "../types"
import { contribution, expense, income } from "./test-flows"
import { amounts, rowAt, run } from "./test-helpers"

const cash: Account = { id: "cash", kind: "asset", rate: 0 }
const savings: Account = { id: "savings", kind: "asset", rate: 0 }
const other: Account = { id: "other", kind: "asset", rate: 0 }

describe("asset contributions are capped at available cashflow", () => {
	it("applies only the available part and reports the unfunded part", () => {
		const projection = run({
			accounts: [cash, savings],
			balances: { cash: 0, savings: 0 },
			flows: [income("pay", 100), contribution("save", "savings", 250)],
			surplus: [{ account: "cash" }],
			contribute: ["savings"],
			horizon: "2026-01-01",
		})
		expect(amounts(rowAt(projection, "2026-01-01"))).toEqual({ cash: 0, savings: 100 })
		expect(projection.unfundedContributions).toEqual([{ account: "savings", amount: 150 }])
		expect(projection.annual[0]).toMatchObject({
			closingNetWorth: 100,
			contributions: 100,
			unfundedContributions: 150,
			interest: 0,
		})
	})

	it("leaves an account untouched when zero income leaves nothing available", () => {
		const projection = run({
			accounts: [cash, savings],
			balances: { cash: 0, savings: 0 },
			flows: [contribution("save", "savings", 500)],
			surplus: [{ account: "cash" }],
			contribute: ["savings"],
			horizon: "2026-01-01",
		})
		expect(amounts(rowAt(projection, "2026-01-01"))).toEqual({ cash: 0, savings: 0 })
		expect(projection.runsOut).toBeUndefined()
		expect(projection.unfundedContributions).toEqual([{ account: "savings", amount: 500 }])
		expect(projection.annual[0]).toMatchObject({
			contributions: 0,
			unfundedContributions: 500,
			interest: 0,
		})
	})

	it("does not turn an expense shortfall into a contribution shortfall", () => {
		const projection = run({
			accounts: [cash, savings],
			balances: { cash: 50, savings: 0 },
			flows: [expense("bill", 100), contribution("save", "savings", 500)],
			surplus: [{ account: "cash" }],
			contribute: ["savings"],
			withdraw: ["cash"],
			horizon: "2026-01-01",
		})
		expect(projection.runsOut).toEqual({ date: "2026-01-01", unmet: 50 })
		expect(amounts(rowAt(projection, "2026-01-01"))).toEqual({ cash: 0, savings: 0 })
		expect(projection.unfundedContributions).toEqual([{ account: "savings", amount: 500 }])
		expect(projection.annual[0]).toMatchObject({
			contributions: 0,
			unfundedContributions: 500,
			unmet: 50,
		})
	})

	it("keeps a debt payment an obligation that can cause a shortfall", () => {
		const projection = run({
			accounts: [cash, { id: "loan", kind: "liability", rate: 0 }],
			balances: { cash: 0, loan: 100 },
			flows: [contribution("repay", "loan", 100)],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2026-01-01",
		})
		expect(projection.runsOut).toEqual({ date: "2026-01-01", unmet: 100 })
		expect(projection.unfundedContributions).toEqual([])
		expect(projection.annual[0]).toMatchObject({ contributions: 100, unfundedContributions: 0 })
	})
})

describe("asset contribution allocation order", () => {
	it("funds in contribute order and starves the lower priority", () => {
		const projection = run({
			accounts: [cash, savings, other],
			balances: { cash: 0, savings: 0, other: 0 },
			flows: [
				income("pay", 100),
				contribution("save-one", "savings", 80),
				contribution("save-two", "other", 80),
			],
			surplus: [{ account: "cash" }],
			contribute: ["savings", "other"],
			horizon: "2026-01-01",
		})
		expect(amounts(rowAt(projection, "2026-01-01"))).toEqual({ cash: 0, other: 20, savings: 80 })
		expect(projection.unfundedContributions).toEqual([{ account: "other", amount: 60 }])
	})

	it("changes the allocation only when the cap binds", () => {
		const setup = {
			accounts: [cash, savings, other],
			balances: { cash: 0, savings: 0, other: 0 },
			flows: [
				income("pay", 100),
				contribution("save-one", "savings", 80),
				contribution("save-two", "other", 80),
			],
			surplus: [{ account: "cash" }],
			horizon: "2026-01-01",
		} as const
		const forward = run({ ...setup, contribute: ["savings", "other"] })
		const reverse = run({ ...setup, contribute: ["other", "savings"] })
		expect(amounts(rowAt(reverse, "2026-01-01"))).toEqual({ cash: 0, other: 80, savings: 20 })
		expect(reverse.unfundedContributions).toEqual([{ account: "savings", amount: 60 }])
		const uncapped = run({
			...setup,
			flows: [
				income("pay", 200),
				contribution("save-one", "savings", 80),
				contribution("save-two", "other", 80),
			],
			contribute: ["savings", "other"],
		})
		const uncappedReverse = run({
			...setup,
			flows: [
				income("pay", 200),
				contribution("save-one", "savings", 80),
				contribution("save-two", "other", 80),
			],
			contribute: ["other", "savings"],
		})
		expect(uncappedReverse.rows).toEqual(uncapped.rows)
		expect(forward.rows).not.toEqual(reverse.rows)
	})

	it("sums same-date amounts per account before allocating", () => {
		const projection = run({
			accounts: [cash, savings],
			balances: { cash: 0, savings: 0 },
			flows: [
				income("pay", 100),
				contribution("save-one", "savings", 60),
				contribution("save-two", "savings", 60),
			],
			surplus: [{ account: "cash" }],
			contribute: ["savings"],
			horizon: "2026-01-01",
		})
		expect(amounts(rowAt(projection, "2026-01-01"))).toEqual({ cash: 0, savings: 100 })
		expect(projection.unfundedContributions).toEqual([{ account: "savings", amount: 20 }])
	})

	it("is unchanged by flow order and by inert contribute entries", () => {
		const setup = {
			accounts: [cash, savings, other],
			balances: { cash: 0, savings: 0, other: 0 },
			flows: [
				income("pay", 100),
				contribution("save-one", "savings", 80),
				contribution("save-two", "other", 80),
			],
			surplus: [{ account: "cash" }],
			contribute: ["savings", "other"],
			horizon: "2026-01-01",
		} as const
		const base = run(setup)
		const shuffled = run({ ...setup, flows: [...setup.flows].reverse() })
		const inert = run({ ...setup, contribute: ["savings", "other", "cash"] })
		expect(JSON.stringify(shuffled)).toBe(JSON.stringify(base))
		expect(JSON.stringify(inert)).toBe(JSON.stringify(base))
	})
})

describe("unfunded totals across annual roll-ups", () => {
	it("rolls unfunded amounts up per annual roll-up and in total, sorted by account", () => {
		const projection = run({
			accounts: [cash, savings, other],
			balances: { cash: 0, savings: 0, other: 0 },
			flows: [
				income("pay", 100, { frequency: "annual", start: "2026-06-01" }),
				contribution("save-one", "savings", 80, { frequency: "annual", start: "2026-06-01" }),
				contribution("save-two", "other", 80, { frequency: "annual", start: "2026-06-01" }),
			],
			surplus: [{ account: "cash" }],
			contribute: ["savings", "other"],
			horizon: "2027-12-31",
		})
		expect(projection.unfundedContributions).toEqual([{ account: "other", amount: 120 }])
		expect(projection.annual.map((rollup) => rollup.unfundedContributions)).toEqual([60, 60])
		expect(projection.annual.map((rollup) => rollup.contributions)).toEqual([100, 100])
	})
})
