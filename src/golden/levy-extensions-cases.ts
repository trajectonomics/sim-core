import { income, prepays } from "../engine/test-flows"
import { emptyCarryIn, makeFixture, withCarryIn } from "../engine/test-helpers"
import type { Fixture } from "../fixtures/fixture"
import type { Levy } from "../types"

function percentage(id: string, percent: number, settlement = { month: 3, day: 31 }): Levy {
	return withCarryIn(
		{
			id,
			period: { month: 1, day: 1 },
			settlement,
			measures: [
				{ id: "gross", op: "tally", label: "salary", basis: "gross" },
				{ id: "due", op: "scale", of: "gross", num: percent, den: 100, rounding: "halfUp" },
			],
			due: "due",
		},
		emptyCarryIn("2025-01-01"),
	)
}

/** Two Levies with different settlement dates, splitting one Flow's Prepayment. */
export const levySeveral: Fixture = makeFixture({
	accounts: [{ id: "cash", kind: "asset", rate: 0 }],
	balances: { cash: 0 },
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	horizon: "2027-12-31",
	levies: [percentage("national", 10), percentage("local", 5, { month: 6, day: 30 })],
	flows: [
		income("salary", 1_000_000, {
			frequency: "monthly",
			start: "2026-01-31",
			label: "salary",
			prepayments: [...prepays("national", 300), ...prepays("local", 200)],
		}),
	],
})

/** A Dated constant stepping during 2027 and again on a Settlement date. */
export const levyStepped: Fixture = makeFixture({
	accounts: [{ id: "cash", kind: "asset", rate: 0 }],
	balances: { cash: 5_000_000 },
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	start: "2026-01-01",
	horizon: "2028-12-31",
	levy: withCarryIn(
		{
			id: "stepped",
			period: { month: 1, day: 1 },
			settlement: { month: 3, day: 31 },
			measures: [
				{
					id: "due",
					op: "const",
					value: 100_000,
					steps: [
						{ from: "2026-06-01", value: 200_000 },
						{ from: "2027-03-31", value: 300_000 },
						{ from: "2028-01-01", value: 400_000 },
					],
				},
			],
			due: "due",
		},
		emptyCarryIn("2025-01-01"),
	),
})
