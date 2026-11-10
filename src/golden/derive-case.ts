import { income } from "../engine/test-flows"
import { makeFixture } from "../engine/test-helpers"
import type { Fixture } from "../fixtures/fixture"
import type { Derive } from "../types"

function portion(flow: string, percent: number): Derive {
	return {
		measures: [
			{ id: "source", op: "flow", flow },
			{ id: "result", op: "scale", of: "source", num: percent, den: 100, rounding: "halfUp" },
		],
		result: "result",
	}
}

/** Rent at 30% of salary and a 10% derived contribution through a raise. */
export const deriveRent: Fixture = makeFixture({
	accounts: [
		{ id: "cash", kind: "asset", rate: 0 },
		{ id: "savings", kind: "asset", rate: 0 },
	],
	balances: { cash: 1_000_000 },
	surplus: [{ account: "cash" }],
	contribute: ["savings"],
	withdraw: ["cash"],
	start: "2026-01-01",
	horizon: "2027-12-31",
	resolution: "month",
	flows: [
		income("salary", 1_000_000, {
			frequency: "monthly",
			start: "2026-01-31",
			growth: { bps: 5000 },
		}),
		{
			id: "rent",
			kind: "expense",
			frequency: "monthly",
			start: "2026-01-31",
			derive: portion("salary", 30),
		},
		{
			id: "save",
			kind: "contribution",
			target: "savings",
			frequency: "monthly",
			start: "2026-01-31",
			derive: portion("salary", 10),
		},
	],
})
