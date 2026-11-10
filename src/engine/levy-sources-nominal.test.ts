import { describe, expect, it } from "bun:test"
import type { Account, Levy, MinorUnits, Projection } from "../types"
import { contribution, income } from "./test-flows"
import { amounts, emptyCarryIn, rowAt, run, withCarryIn } from "./test-helpers"

const returnsLevy: Levy = withCarryIn(
	{
		id: "returns",
		period: { month: 1, day: 1 },
		settlement: { month: 3, day: 31 },
		measures: [
			{ id: "interest", op: "tally", label: "interest", basis: "returns" },
			{ id: "zero", op: "const", value: 0 },
		],
		due: "zero",
		carryIn: [],
	},
	emptyCarryIn("2025-01-01"),
)

const gainsLevy: Levy = withCarryIn(
	{
		id: "gains",
		period: { month: 1, day: 1 },
		settlement: { month: 3, day: 31 },
		measures: [
			{ id: "gain", op: "tally", label: "gain", basis: "gains" },
			{ id: "zero", op: "const", value: 0 },
		],
		due: "zero",
		carryIn: [],
	},
	emptyCarryIn("2025-01-01"),
)

function values(projection: Projection, id: string): readonly MinorUnits[] {
	return (
		projection.levy?.periods.map((period) => {
			const found = period.measures.find((item) => item.id === id)
			if (found === undefined) throw new Error(`Missing ${id}`)
			return found.value
		}) ?? []
	)
}

const nominalDeposit: Account = {
	id: "deposit",
	kind: "asset",
	rate: 1200,
	compounding: "monthly",
	returnLabel: "interest",
}

describe("Levy tally sources on a nominal Account", () => {
	it("attributes returns across the nominal capitalisation the read performs", () => {
		const projection = run({
			accounts: [nominalDeposit],
			balances: { deposit: 100_000 },
			surplus: [{ account: "deposit" }],
			start: "2026-01-01",
			horizon: "2027-06-30",
			resolution: "month",
			levy: withCarryIn(returnsLevy, emptyCarryIn("2025-01-01")),
		})
		const pieces = values(projection, "interest")
		expect(pieces.length).toBe(3)
		expect(pieces.every((value) => value >= 0)).toBe(true)
		expect(pieces.reduce((sum, value) => sum + value, 0)).toBe(
			amounts(rowAt(projection, "2027-06-30"))["deposit"]! - 100_000,
		)
	})

	it("adds a contribution to basis through the nominal commit", () => {
		// Without the nominal commit booking basis, a 75,000 sale would look like a 25,000 gain.
		const projection = run({
			accounts: [
				{
					id: "brokerage",
					kind: "asset",
					rate: 0,
					compounding: "monthly",
					gainLabel: "gain",
				},
			],
			balances: { brokerage: 100_000 },
			basis: { brokerage: 100_000 },
			flows: [
				income("pay", 50_000, { start: "2026-01-01" }),
				contribution("save", "brokerage", 50_000, { start: "2026-01-01" }),
				{
					id: "sell",
					kind: "expense",
					amount: 75_000,
					frequency: "once",
					start: "2026-06-01",
					growth: { bps: 0 },
				},
			],
			surplus: [{ account: "brokerage" }],
			contribute: ["brokerage"],
			withdraw: ["brokerage"],
			start: "2026-01-01",
			horizon: "2026-12-31",
			levy: withCarryIn(gainsLevy, emptyCarryIn("2025-01-01")),
		})
		expect(values(projection, "gain")).toEqual([0, 0])
	})
})
