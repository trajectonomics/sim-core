import { describe, expect, it } from "bun:test"
import type { Levy } from "../types"
import { contribution, income } from "./test-flows"
import { amounts, rowAt, run } from "./test-helpers"

const fundedLevy = (label: string): Levy => ({
	id: "funded-levy",
	period: { month: 1, day: 1 },
	settlement: { month: 3, day: 31 },
	measures: [{ id: "saved", op: "tally", label, basis: "funded" }],
	due: "saved",
})

describe("Levy funded tallies", () => {
	it("uses the amount applied when a liability payment is capped", () => {
		const projection = run({
			accounts: [
				{ id: "cash", kind: "asset", rate: 0 },
				{ id: "debt", kind: "liability", rate: 0 },
			],
			balances: { cash: 1000, debt: 30 },
			flows: [contribution("fund", "debt", 100, { label: "fund", start: "2026-01-02" })],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			start: "2026-01-01",
			horizon: "2027-03-31",
			levy: fundedLevy("fund"),
		})
		expect(projection.levy!.periods[0]).toMatchObject({
			prepaid: 0,
			due: 30,
			settlement: 30,
			settled: true,
		})
		expect(amounts(rowAt(projection, "2027-03-31"))).toEqual({ cash: 940, debt: 0 })
	})

	it("uses the amount applied when Available cashflow caps an asset contribution", () => {
		const projection = run({
			accounts: [
				{ id: "cash", kind: "asset", rate: 0 },
				{ id: "savings", kind: "asset", rate: 0 },
			],
			balances: { cash: 1000, savings: 0 },
			flows: [
				income("pay", 100, { start: "2026-01-02" }),
				contribution("save", "savings", 150, { label: "fund", start: "2026-01-02" }),
			],
			surplus: [{ account: "cash" }],
			contribute: ["savings"],
			withdraw: ["cash"],
			start: "2026-01-01",
			horizon: "2027-03-31",
			levy: fundedLevy("fund"),
		})
		expect(projection.levy!.periods[0]).toMatchObject({
			prepaid: 0,
			due: 100,
			settlement: 100,
			settled: true,
		})
		expect(projection.unfundedContributions).toEqual([{ account: "savings", amount: 50 }])
		expect(amounts(rowAt(projection, "2027-03-31"))).toEqual({ cash: 900, savings: 100 })
	})

	it("sums same-date contributions before splitting a capped amount by label", () => {
		const projection = run({
			accounts: [
				{ id: "cash", kind: "asset", rate: 0 },
				{ id: "debt", kind: "liability", rate: 0 },
			],
			balances: { cash: 1000, debt: 50 },
			flows: [
				contribution("a", "debt", 30, { label: "a", start: "2026-01-02" }),
				contribution("b", "debt", 40, { label: "b", start: "2026-01-02" }),
			],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			start: "2026-01-01",
			horizon: "2027-03-31",
			levy: fundedLevy("b"),
		})
		expect(projection.levy!.periods[0]).toMatchObject({ due: 20, settlement: 20, settled: true })
		expect(amounts(rowAt(projection, "2027-03-31"))).toEqual({ cash: 930, debt: 0 })
	})
})
