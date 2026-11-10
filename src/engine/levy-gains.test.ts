import { describe, expect, it } from "bun:test"
import type { Account, Levy, MinorUnits, Projection, SurplusStep } from "../types"
import { contribution, expense, income } from "./test-flows"
import { amounts, emptyCarryIn, periodFrom, rowAt, run, withCarryIn } from "./test-helpers"

const gainsLevy: Levy = {
	id: "gains",
	period: { month: 1, day: 1 },
	settlement: { month: 3, day: 31 },
	measures: [
		{ id: "gain", op: "tally", label: "gain", basis: "gains" },
		{ id: "zero", op: "const", value: 0 },
	],
	due: "zero",
}

function gained(projection: Projection, from: string): MinorUnits {
	const found = periodFrom(projection, from).measures.find((item) => item.id === "gain")
	if (found === undefined) throw new Error("Missing gain measure")
	return found.value
}

const brokerage: Account = { id: "brokerage", kind: "asset", rate: 0, gainLabel: "gain" }
const empty = withCarryIn(gainsLevy, emptyCarryIn("2025-01-01"))

describe("Levy gains tally", () => {
	it("realises a proportional share of the pooled basis on a partial sale", () => {
		// 100,000 basis on 120,000 of value; a 60,000 sale uses 50,000 basis and gains 10,000.
		const projection = run({
			accounts: [brokerage],
			balances: { brokerage: 120_000 },
			basis: { brokerage: 100_000 },
			flows: [expense("sell", 60_000, { start: "2026-06-01" })],
			surplus: [{ account: "brokerage" }],
			withdraw: ["brokerage"],
			start: "2026-01-01",
			horizon: "2026-12-31",
			levy: empty,
		})
		expect(gained(projection, "2026-01-01")).toBe(10_000)
	})

	it("tallies a sale below cost as a negative gain", () => {
		// 100,000 basis on 80,000 of value; a 40,000 sale uses 50,000 basis and loses 10,000.
		const projection = run({
			accounts: [brokerage],
			balances: { brokerage: 80_000 },
			basis: { brokerage: 100_000 },
			flows: [expense("sell", 40_000, { start: "2026-06-01" })],
			surplus: [{ account: "brokerage" }],
			withdraw: ["brokerage"],
			start: "2026-01-01",
			horizon: "2026-12-31",
			levy: empty,
		})
		expect(gained(projection, "2026-01-01")).toBe(-10_000)
	})

	it("adds contributions and surplus fills to the pooled basis", () => {
		// 100,000 + 20,000 contributed + 30,000 surplus leaves 150,000 basis on 150,000 value,
		// so a 75,000 sale uses exactly 75,000 basis and realises nothing.
		const surplus: readonly SurplusStep[] = [{ account: "brokerage" }]
		const projection = run({
			accounts: [brokerage],
			balances: { brokerage: 100_000 },
			basis: { brokerage: 100_000 },
			flows: [
				income("pay", 50_000, { start: "2026-01-01" }),
				contribution("save", "brokerage", 20_000, { start: "2026-01-01" }),
				expense("sell", 75_000, { start: "2026-06-01" }),
			],
			surplus,
			contribute: ["brokerage"],
			withdraw: ["brokerage"],
			start: "2026-01-01",
			horizon: "2026-12-31",
			levy: empty,
		})
		expect(gained(projection, "2026-01-01")).toBe(0)
	})

	it("never takes more basis than an Account holds", () => {
		const projection = run({
			accounts: [brokerage],
			balances: { brokerage: 100_000 },
			basis: { brokerage: 100_000 },
			flows: [
				expense("a", 30_000, { start: "2026-02-01" }),
				expense("b", 30_000, { start: "2026-04-01" }),
				expense("c", 30_000, { start: "2026-06-01" }),
				expense("d", 10_000, { start: "2026-08-01" }),
			],
			surplus: [{ account: "brokerage" }],
			withdraw: ["brokerage"],
			start: "2026-01-01",
			horizon: "2026-12-31",
			levy: empty,
		})
		expect(gained(projection, "2026-01-01")).toBe(0)
	})

	it("realises a Settlement's sale in the period after the one it settles", () => {
		// The 2026 period settles on 2027-03-31 for 1,000 out of 120,000; 833.33 of basis is
		// used up, so the following period sees the 167 gain.
		const projection = run({
			accounts: [brokerage],
			balances: { brokerage: 120_000 },
			basis: { brokerage: 100_000 },
			surplus: [{ account: "brokerage" }],
			withdraw: ["brokerage"],
			start: "2026-07-01",
			horizon: "2027-12-31",
			levy: withCarryIn(
				{
					...gainsLevy,
					measures: [...gainsLevy.measures, { id: "due", op: "const", value: 1000 }],
					due: "due",
				},
				emptyCarryIn("2026-01-01"),
			),
		})
		expect(gained(projection, "2026-01-01")).toBe(0)
		expect(gained(projection, "2027-01-01")).toBe(167)
	})

	it("never takes more basis than the opening basis plus inflows", () => {
		// 100,000 basis on 80,000 of value, drained in four sales: each uses 25,000 basis, so the
		// account gives up exactly its 100,000 basis and the four losses sum to -20,000.
		const projection = run({
			accounts: [brokerage],
			balances: { brokerage: 80_000 },
			basis: { brokerage: 100_000 },
			flows: [
				expense("a", 20_000, { start: "2026-02-01" }),
				expense("b", 20_000, { start: "2026-04-01" }),
				expense("c", 20_000, { start: "2026-06-01" }),
				expense("d", 20_000, { start: "2026-08-01" }),
			],
			surplus: [{ account: "brokerage" }],
			withdraw: ["brokerage"],
			start: "2026-01-01",
			horizon: "2026-12-31",
			levy: empty,
		})
		expect(gained(projection, "2026-01-01")).toBe(-20_000)
		expect(amounts(rowAt(projection, "2026-12-31"))["brokerage"]).toBe(0)
	})

	it("adds a signed gains Carry-in to the period it seeds", () => {
		const projection = run({
			accounts: [brokerage],
			balances: { brokerage: 120_000 },
			basis: { brokerage: 100_000 },
			flows: [expense("sell", 60_000, { start: "2026-08-01" })],
			surplus: [{ account: "brokerage" }],
			withdraw: ["brokerage"],
			start: "2026-07-01",
			horizon: "2026-12-31",
			levy: withCarryIn(gainsLevy, {
				periodStart: "2026-01-01",
				tallies: [{ label: "gain", basis: "gains", amount: -2_000 }],
				prepaid: 0,
			}),
		})
		expect(gained(projection, "2026-01-01")).toBe(8_000)
	})

	it("gives the same Levy for day and month resolution and for any order", () => {
		const base = {
			accounts: [brokerage, { id: "cash", kind: "asset", rate: 0 }] as const,
			balances: { brokerage: 100_000, cash: 0 },
			basis: { brokerage: 80_000 },
			flows: [
				income("pay", 500_000, { start: "2026-01-01" }),
				expense("sell", 25_000, { start: "2026-08-01" }),
			],
			surplus: [{ account: "cash" }],
			withdraw: ["cash", "brokerage"],
			start: "2026-01-01",
			horizon: "2027-12-31",
			levy: empty,
		}
		const day = run({ ...base, resolution: "day" })
		const month = run({ ...base, resolution: "month" })
		expect(day.levy).toEqual(month.levy)
		const reversed = run({
			...base,
			accounts: [...base.accounts].reverse(),
			balances: { cash: 0, brokerage: 100_000 },
		})
		expect(reversed.levy).toEqual(day.levy)
	})
})
