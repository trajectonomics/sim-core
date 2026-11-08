import { describe, expect, it } from "bun:test"
import type { Account } from "../types"
import { contribution, expense, income } from "./test-flows"
import { amounts, problems, rowAt, run } from "./test-helpers"

const cash: Account = { id: "cash", kind: "asset", rate: 0 }

describe("lazy per-account commits", () => {
	it("grows an untouched balance in one exact whole-year step", () => {
		const projection = run({
			accounts: [cash, { id: "savings", kind: "asset", rate: 10_000 }],
			balances: { cash: 0, savings: 100 },
			surplus: [{ account: "cash" }],
		})
		expect(amounts(rowAt(projection, "2027-01-01"))).toEqual({ cash: 0, savings: 200 })
	})

	it("does not let an unrelated zero-amount flow change any number", () => {
		const setup = {
			accounts: [{ id: "savings", kind: "asset", rate: 400 }],
			balances: { savings: 10 },
			surplus: [{ account: "savings" }],
			horizon: "2029-01-01",
		} as const
		const quiet = run(setup)
		const busy = run({ ...setup, flows: [income("zero", 0, { frequency: "monthly" })] })
		expect(busy.rows).toEqual(quiet.rows)
	})

	it("applies income, expenses, contributions, then surplus in order", () => {
		const projection = run({
			accounts: [cash, { id: "savings", kind: "asset", rate: 0 }],
			balances: { cash: 0, savings: 0 },
			flows: [income("pay", 100), expense("bill", 30), contribution("save", "savings", 20)],
			surplus: [{ account: "cash" }],
			contribute: ["savings"],
			horizon: "2026-01-01",
		})
		expect(amounts(rowAt(projection, "2026-01-01"))).toEqual({ cash: 50, savings: 20 })
	})

	it("never pulls a surplus account back down from an exceeded ceiling", () => {
		const projection = run({
			accounts: [cash, { id: "vault", kind: "asset", rate: 0 }],
			balances: { cash: 0, vault: 100 },
			flows: [income("pay", 10)],
			surplus: [{ account: "vault", upTo: 50 }, { account: "cash" }],
			horizon: "2026-01-01",
		})
		expect(amounts(rowAt(projection, "2026-01-01"))).toEqual({ cash: 10, vault: 100 })
	})
})

describe("contributions and liability caps", () => {
	it("sums same-date contributions before capping a liability", () => {
		const projection = run({
			accounts: [cash, { id: "debt", kind: "liability", rate: 0 }],
			balances: { cash: 0, debt: 50 },
			flows: [
				income("pay", 70),
				contribution("first", "debt", 30),
				contribution("second", "debt", 40),
			],
			surplus: [{ account: "cash" }],
			horizon: "2026-01-01",
		})
		expect(amounts(rowAt(projection, "2026-01-01"))).toEqual({ cash: 20, debt: 0 })
	})

	it("returns a liability's paid-off excess to net on a later date", () => {
		const projection = run({
			accounts: [cash, { id: "debt", kind: "liability", rate: 0 }],
			balances: { cash: 100, debt: 100 },
			flows: [
				contribution("january", "debt", 60),
				contribution("february", "debt", 60, { start: "2026-02-01" }),
				income("bonus", 120, { start: "2026-02-01" }),
			],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2026-02-01",
		})
		expect(amounts(rowAt(projection, "2026-01-01"))).toEqual({ cash: 40, debt: 40 })
		expect(amounts(rowAt(projection, "2026-02-01"))).toEqual({ cash: 120, debt: 0 })
	})

	it("never funds an asset contribution from existing assets", () => {
		const projection = run({
			accounts: [cash, { id: "savings", kind: "asset", rate: 0 }],
			balances: { cash: 100, savings: 0 },
			flows: [contribution("save", "savings", 100)],
			surplus: [{ account: "cash" }],
			contribute: ["savings"],
			withdraw: ["savings", "cash"],
			horizon: "2026-01-01",
		})
		expect(amounts(rowAt(projection, "2026-01-01"))).toEqual({ cash: 100, savings: 0 })
		expect(projection.runsOut).toBeUndefined()
		expect(projection.unfundedContributions).toEqual([{ account: "savings", amount: 100 }])
	})
})

describe("shortfall and locked accounts", () => {
	it("drains accessible money, records the unmet amount, and stops", () => {
		const projection = run({
			accounts: [cash, { id: "vault", kind: "asset", rate: 0, lockedUntil: "2026-01-03" }],
			balances: { cash: 50, vault: 100 },
			flows: [expense("bill", 100)],
			surplus: [{ account: "cash" }],
			withdraw: ["vault", "cash"],
			horizon: "2026-01-10",
		})
		expect(projection.runsOut).toEqual({ date: "2026-01-01", unmet: 50 })
		expect(projection.rows).toHaveLength(1)
		expect(amounts(rowAt(projection, "2026-01-01"))).toEqual({ cash: 0, vault: 100 })
	})

	it("skips locked money the day before unlock and uses it on the unlock date", () => {
		const locked = {
			accounts: [{ id: "vault", kind: "asset", rate: 0, lockedUntil: "2026-01-03" }] as const,
			balances: { vault: 100 },
			surplus: [{ account: "vault" }],
			withdraw: ["vault"],
			horizon: "2026-01-03",
		}
		const before = run({ ...locked, flows: [expense("bill", 100, { start: "2026-01-02" })] })
		expect(before.runsOut).toEqual({ date: "2026-01-02", unmet: 100 })
		const onDate = run({ ...locked, flows: [expense("bill", 100, { start: "2026-01-03" })] })
		expect(onDate.runsOut).toBeUndefined()
		expect(amounts(rowAt(onDate, "2026-01-03"))).toEqual({ vault: 0 })
	})
})

describe("negative rates and overflow", () => {
	it("supports negative account rates and negative flow growth", () => {
		const account = run({
			accounts: [{ id: "savings", kind: "asset", rate: -1000 }],
			balances: { savings: 100 },
			surplus: [{ account: "savings" }],
			horizon: "2027-01-01",
		})
		expect(amounts(rowAt(account, "2027-01-01"))).toEqual({ savings: 90 })
		const flow = run({
			accounts: [cash],
			balances: { cash: 0 },
			flows: [income("pay", 100, { frequency: "annual", growth: { bps: -1000 } })],
			surplus: [{ account: "cash" }],
			horizon: "2027-01-01",
		})
		expect(amounts(rowAt(flow, "2026-01-01"))).toEqual({ cash: 100 })
		expect(amounts(rowAt(flow, "2027-01-01"))).toEqual({ cash: 190 })
	})

	it("fails the whole projection when a committed account overflows", () => {
		expect(
			problems({
				accounts: [{ id: "savings", kind: "asset", rate: 0 }],
				balances: { savings: Number.MAX_SAFE_INTEGER },
				flows: [income("penny", 1)],
				surplus: [{ account: "savings" }],
				horizon: "2026-01-01",
			}),
		).toEqual([{ code: "VALUE_OVERFLOW", date: "2026-01-01", account: "savings" }])
	})

	it("fails when safe per-account values sum beyond the safe range", () => {
		const half = 4_503_599_627_370_496
		expect(
			problems({
				accounts: [
					{ id: "a", kind: "asset", rate: 0 },
					{ id: "b", kind: "asset", rate: 0 },
				],
				balances: { a: half, b: half },
				surplus: [{ account: "a" }],
				horizon: "2026-01-01",
			}),
		).toEqual([{ code: "VALUE_OVERFLOW", date: "2026-01-01" }])
	})
})
