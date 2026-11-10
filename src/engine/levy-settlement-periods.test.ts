import { describe, expect, it } from "bun:test"
import type { Levy } from "../types"
import { income, prepays } from "./test-flows"
import { amounts, emptyCarryIn, periodFrom, rowAt, run, withCarryIn } from "./test-helpers"

const zero: Levy = {
	id: "zero",
	period: { month: 1, day: 1 },
	settlement: { month: 1, day: 1 },
	measures: [{ id: "due", op: "const", value: 0 }],
	due: "due",
}

const grossLevy: Levy = withCarryIn(
	{
		id: "gross",
		period: { month: 1, day: 1 },
		settlement: { month: 1, day: 1 },
		measures: [{ id: "gross", op: "tally", label: "x", basis: "gross" }],
		due: "gross",
	},
	emptyCarryIn("2025-01-01"),
)

describe("Settlement period boundaries", () => {
	it("settles a period on the next period's start without mixing their Flows", () => {
		const projection = run({
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			balances: { cash: 0 },
			flows: [
				income("first", 100, {
					start: "2026-06-01",
					label: "x",
					prepayments: prepays("gross", 1000),
				}),
				income("second", 50, { start: "2027-01-01", label: "x" }),
			],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			start: "2026-01-01",
			horizon: "2027-01-01",
			levy: grossLevy,
		})
		expect(periodFrom(projection, "2026-01-01")).toMatchObject({
			from: "2026-01-01",
			to: "2026-12-31",
			settlementDate: "2027-01-01",
			prepaid: 10,
			due: 100,
			settlement: 90,
			settled: true,
		})
		expect(periodFrom(projection, "2027-01-01")).toMatchObject({
			from: "2027-01-01",
			to: "2027-12-31",
			settlementDate: "2028-01-01",
			prepaid: 0,
			due: 50,
			settled: false,
			partial: true,
		})
		expect(amounts(rowAt(projection, "2027-01-01"))).toEqual({ cash: 50 })
	})

	it("runs twelve-month periods from the Levy's period month and day", () => {
		const levy: Levy = withCarryIn(
			{
				...zero,
				id: "april",
				period: { month: 4, day: 1 },
				settlement: { month: 6, day: 30 },
			},
			emptyCarryIn("2025-04-01"),
		)
		const projection = run({
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			balances: { cash: 0 },
			surplus: [{ account: "cash" }],
			start: "2026-04-01",
			horizon: "2028-06-30",
			levy,
		})
		expect(
			projection.levies![0]!.periods.map((period) => [
				period.from,
				period.to,
				period.settlementDate,
				period.settled,
				period.partial,
			]),
		).toEqual([
			["2025-04-01", "2026-03-31", "2026-06-30", true, false],
			["2026-04-01", "2027-03-31", "2027-06-30", true, false],
			["2027-04-01", "2028-03-31", "2028-06-30", true, false],
			["2028-04-01", "2029-03-31", "2029-06-30", false, true],
		])
	})

	it("tallies income after its annual growth", () => {
		const projection = run({
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			balances: { cash: 0 },
			flows: [
				income("x", 100, {
					frequency: "annual",
					start: "2025-01-01",
					growth: { bps: 1000 },
					label: "x",
				}),
			],
			surplus: [{ account: "cash" }],
			start: "2026-01-01",
			horizon: "2026-12-31",
			levy: grossLevy,
		})
		expect(periodFrom(projection, "2026-01-01").due).toBe(110)
	})

	it("reports a Settlement beyond the last supported year without throwing", () => {
		const projection = run({
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			balances: { cash: 0 },
			surplus: [{ account: "cash" }],
			start: "9998-01-01",
			horizon: "9998-12-31",
			levy: withCarryIn(
				{ ...zero, settlement: { month: 12, day: 31 } },
				emptyCarryIn("9997-01-01"),
			),
		})
		expect(projection.levies![0]!.periods).toHaveLength(2)
		expect(periodFrom(projection, "9998-01-01")).toMatchObject({
			to: "9998-12-31",
			settlementDate: "9999-12-31",
			settled: false,
			partial: false,
		})
	})
})
