import { describe, expect, it } from "bun:test"
import { oracleCountedDays } from "../golden/oracle-date"
import { oracleGrow } from "../golden/oracle-money"
import type { Account, Levy, MinorUnits, Projection } from "../types"
import { contribution, expense, income } from "./test-flows"
import { amounts, emptyCarryIn, periodFrom, rowAt, run, withCarryIn } from "./test-helpers"

/** A Levy that only reports its returns total; `due` stays 0 so no cash moves. */
const returnsLevy: Levy = {
	id: "returns",
	period: { month: 1, day: 1 },
	settlement: { month: 3, day: 31 },
	measures: [
		{ id: "interest", op: "tally", label: "interest", basis: "returns" },
		{ id: "zero", op: "const", value: 0 },
	],
	due: "zero",
}

function returned(projection: Projection, from: string): MinorUnits {
	const found = periodFrom(projection, from).measures.find((item) => item.id === "interest")
	if (found === undefined) throw new Error("Missing interest measure")
	return found.value
}

function grown(opening: bigint, rate: number, from: string, to: string): number {
	return Number(oracleGrow(opening, rate, oracleCountedDays(from, to)) - opening)
}

const deposit: Account = { id: "deposit", kind: "asset", rate: 1000, returnLabel: "interest" }

describe("Levy returns tally", () => {
	it("attributes growth to the period it accrued in, never to an unlabelled Account", () => {
		const projection = run({
			accounts: [deposit, { id: "pension", kind: "asset", rate: 1000 }],
			balances: { deposit: 100_000, pension: 100_000 },
			surplus: [{ account: "deposit" }],
			start: "2028-01-01",
			horizon: "2029-12-31",
			levy: withCarryIn(returnsLevy, emptyCarryIn("2027-01-01")),
		})
		const first = grown(100_000n, 1000, "2028-01-01", "2028-12-31")
		const whole = grown(100_000n, 1000, "2028-01-01", "2029-12-31")
		expect(returned(projection, "2028-01-01")).toBe(first)
		expect(returned(projection, "2029-01-01")).toBe(whole - first)
		expect(first).toBeGreaterThan(0)
	})

	it("tallies a losing period as a negative amount", () => {
		const projection = run({
			accounts: [{ id: "deposit", kind: "asset", rate: -1000, returnLabel: "interest" }],
			balances: { deposit: 100_000 },
			surplus: [{ account: "deposit" }],
			start: "2028-01-01",
			horizon: "2028-12-31",
			levy: withCarryIn(returnsLevy, emptyCarryIn("2027-01-01")),
		})
		const expected = grown(100_000n, -1000, "2028-01-01", "2028-12-31")
		expect(expected).toBeLessThan(0)
		expect(returned(projection, "2028-01-01")).toBe(expected)
	})

	it("reports growth through the run end for a partial period", () => {
		const projection = run({
			accounts: [deposit],
			balances: { deposit: 100_000 },
			surplus: [{ account: "deposit" }],
			start: "2028-01-01",
			horizon: "2028-06-30",
			levy: withCarryIn(returnsLevy, emptyCarryIn("2027-01-01")),
		})
		expect(periodFrom(projection, "2028-01-01").partial).toBe(true)
		expect(returned(projection, "2028-01-01")).toBe(
			grown(100_000n, 1000, "2028-01-01", "2028-06-30"),
		)
	})

	it("adds a signed returns Carry-in to the period it seeds", () => {
		for (const amount of [5000, -5000]) {
			const projection = run({
				accounts: [{ id: "deposit", kind: "asset", rate: 0, returnLabel: "interest" }],
				balances: { deposit: 100_000 },
				surplus: [{ account: "deposit" }],
				start: "2028-07-01",
				horizon: "2028-12-31",
				levy: withCarryIn(returnsLevy, {
					periodStart: "2028-01-01",
					tallies: [{ label: "interest", basis: "returns", amount }],
					prepaid: 0,
				}),
			})
			expect(returned(projection, "2028-01-01")).toBe(amount)
		}
	})

	it("keeps the sum of returns equal to the Account's growth", () => {
		const projection = run({
			accounts: [deposit],
			balances: { deposit: 100_000 },
			surplus: [{ account: "deposit" }],
			start: "2028-01-01",
			horizon: "2029-12-31",
			levy: withCarryIn(returnsLevy, emptyCarryIn("2027-01-01")),
		})
		const total = projection.levy!.periods.reduce((sum, period) => {
			const found = period.measures.find((item) => item.id === "interest")
			return sum + (found?.value ?? 0)
		}, 0)
		expect(total).toBe(amounts(rowAt(projection, "2029-12-31"))["deposit"]! - 100_000)
	})

	it("counts net inflows beside the growth in the sum of returns", () => {
		const projection = run({
			accounts: [deposit, { id: "cash", kind: "asset", rate: 0 }],
			balances: { deposit: 100_000, cash: 0 },
			flows: [
				income("pay", 10_000, { start: "2028-01-31" }),
				contribution("save", "deposit", 4_000, { start: "2028-01-31" }),
			],
			surplus: [{ account: "cash" }],
			contribute: ["deposit"],
			withdraw: ["cash"],
			start: "2028-01-01",
			horizon: "2029-12-31",
			levy: withCarryIn(returnsLevy, emptyCarryIn("2027-01-01")),
		})
		const total = projection.levy!.periods.reduce((sum, period) => {
			const found = period.measures.find((item) => item.id === "interest")
			return sum + (found?.value ?? 0)
		}, 0)
		const inflows = projection.annual.reduce((sum, year) => sum + year.contributions, 0)
		expect(total).toBe(amounts(rowAt(projection, "2029-12-31"))["deposit"]! - 100_000 - inflows)
	})

	it("gives the same Levy for day and month resolution and for any order", () => {
		const base = {
			accounts: [deposit, { id: "pension", kind: "asset", rate: 500 }] as const,
			balances: { deposit: 100_000, pension: 50_000 },
			flows: [expense("fee", 1_000, { start: "2029-06-01" })],
			surplus: [{ account: "pension" }],
			withdraw: ["deposit"],
			start: "2028-01-01",
			horizon: "2029-12-31",
			levy: withCarryIn(returnsLevy, emptyCarryIn("2027-01-01")),
		}
		const day = run({ ...base, resolution: "day" })
		const month = run({ ...base, resolution: "month" })
		expect(day.levy).toEqual(month.levy)
		const reversed = run({
			...base,
			accounts: [...base.accounts].reverse(),
			balances: { pension: 50_000, deposit: 100_000 },
		})
		expect(reversed.levy).toEqual(day.levy)
	})
})
