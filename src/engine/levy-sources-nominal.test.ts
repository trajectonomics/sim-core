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
		projection.levies?.[0]?.periods.map((period) => {
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
	it("attributes returns across each nominal capitalisation a read performs", () => {
		// Monthly at 1,200 bps over a 30/31, 28/28 and 31/31 day fraction:
		// Jan 100,000 → +968; Feb 100,968 → +1,010; Mar 101,978 → +1,020. The reads on
		// 1 Feb and 1 Mar capitalise the first two, so a lazy base loses their growth.
		const projection = run({
			accounts: [nominalDeposit],
			balances: { deposit: 100_000 },
			surplus: [{ account: "deposit" }],
			start: "2026-01-01",
			horizon: "2026-03-31",
			resolution: "month",
			levy: withCarryIn(returnsLevy, emptyCarryIn("2025-01-01")),
		})
		expect(values(projection, "interest")).toEqual([0, 2_998])
		expect(amounts(rowAt(projection, "2026-03-31"))["deposit"]).toBe(102_998)
	})

	it("splits a Settlement period whose end falls between capitalisation dates", () => {
		// Quarterly at 1,200 bps, period 15 Feb to 14 Feb. The capitalisations are 484, 1,005,
		// 3,135, 3,229 and 3,326 on 100,000 → 114,201 by 31 Mar 2027; the 14 Feb value adds the
		// 1,663 accrued from 31 Dec, so the first period takes 12,538 and the second 5,089.
		const projection = run({
			accounts: [
				{
					id: "deposit",
					kind: "asset",
					rate: 1200,
					compounding: "quarterly",
					returnLabel: "interest",
				},
			],
			balances: { deposit: 100_000 },
			surplus: [{ account: "deposit" }],
			start: "2026-02-15",
			horizon: "2027-06-30",
			resolution: "month",
			levy: withCarryIn(
				{ ...returnsLevy, period: { month: 2, day: 15 }, settlement: { month: 6, day: 30 } },
				emptyCarryIn("2025-02-15"),
			),
		})
		expect(values(projection, "interest")).toEqual([0, 12_538, 5_089])
		expect(amounts(rowAt(projection, "2027-06-30"))["deposit"]).toBe(117_627)
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
