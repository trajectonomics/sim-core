import { describe, expect, it } from "bun:test"
import type { Levy } from "../types"
import { income, prepays } from "./test-flows"
import { emptyCarryIn, problems, withCarryIn } from "./test-helpers"

const levy: Levy = withCarryIn(
	{
		id: "huge",
		period: { month: 1, day: 1 },
		settlement: { month: 3, day: 31 },
		measures: [{ id: "gross", op: "tally", label: "x", basis: "gross" }],
		due: "gross",
	},
	emptyCarryIn("2025-01-01"),
)

describe("unsafe Levy tallies", () => {
	it("reports a tally that is not a safe integer instead of losing precision", () => {
		expect(
			problems({
				accounts: [{ id: "cash", kind: "asset", rate: 0 }],
				balances: { cash: 0 },
				flows: [
					income("pay", Number.MAX_SAFE_INTEGER, {
						frequency: "monthly",
						start: "2025-01-01",
						growth: { bps: 10_000 },
						label: "x",
						prepayments: prepays("huge", 10_000),
					}),
				],
				surplus: [{ account: "cash" }],
				withdraw: ["cash"],
				start: "2026-01-01",
				horizon: "2027-03-31",
				levy,
			}),
		).toEqual([{ code: "NOT_SAFE_INTEGER", path: ["gross", "x"] }])
	})
})
