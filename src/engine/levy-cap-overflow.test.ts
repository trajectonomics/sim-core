import { describe, expect, it } from "bun:test"
import type { Levy } from "../types"
import { income } from "./test-flows"
import { emptyCarryIn, problems, run, type Setup, withCarryIn } from "./test-helpers"

/** A 3e15 cap doubled each year: safe for 2026, 1.2e16 once the 2027 period is evaluated. */
const levy: Levy = withCarryIn(
	{
		id: "growing",
		period: { month: 1, day: 1 },
		settlement: { month: 3, day: 31 },
		measures: [
			{
				id: "base",
				op: "const",
				value: 3_000_000_000_000_000,
				asOf: "2026-01-01",
				growth: { bps: 10_000 },
			},
			{ id: "wage", op: "tally", label: "wage", basis: "gross" },
			{ id: "due", op: "const", value: 0 },
		],
		due: "due",
	},
	emptyCarryIn("2025-01-01"),
)

const setup = (end?: string): Setup => ({
	accounts: [{ id: "cash", kind: "asset", rate: 0 }],
	balances: { cash: 0 },
	flows: [
		income("salary", 10_000, {
			frequency: "monthly",
			start: "2026-01-31",
			...(end === undefined ? {} : { end }),
			label: "wage",
			cappedPrepayment: { levy: "growing", bps: 620, upTo: "base" },
		}),
	],
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	horizon: "2027-03-31",
	levy,
})

describe("a cap that is not a safe integer", () => {
	it("reports VALUE_OVERFLOW at the Occurrence that reads it", () => {
		expect(problems(setup())).toEqual([{ code: "VALUE_OVERFLOW", date: "2027-01-31" }])
	})

	it("never reports a cap the Projection does not reach", () => {
		const shortfall = setup()
		const projection = run({
			...shortfall,
			flows: [
				...(shortfall.flows ?? []),
				{
					id: "bill",
					kind: "expense",
					amount: 200_000,
					frequency: "once",
					start: "2026-12-15",
					growth: { bps: 0 },
				},
			],
		})
		expect(projection.runsOut?.date).toBe("2026-12-15")
		expect(projection.levies?.[0]?.periods.map((period) => period.from)).toEqual([
			"2025-01-01",
			"2026-01-01",
		])
	})
})
