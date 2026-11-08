import { describe, expect, it } from "bun:test"
import { emptyCarryIn, makeFixture, withCarryIn } from "../engine/test-helpers"
import { financialIndependence } from "../index"
import type { Levy } from "../types"

const levy: Levy = {
	id: "fixed",
	period: { month: 1, day: 1 },
	settlement: { month: 12, day: 31 },
	measures: [{ id: "due", op: "const", value: 1000 }],
	due: "due",
}

describe("Levy settlements in the survival walk", () => {
	it("counts a Settlement inside the horizon", () => {
		const { baseline, scenario, timeline } = makeFixture({
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			balances: { cash: 500 },
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2026-12-31",
			levy: withCarryIn(levy, emptyCarryIn("2025-01-01")),
		})
		expect(
			financialIndependence(baseline, scenario, timeline, { method: "survival" }),
		).toMatchObject({
			ok: true,
			financialIndependence: {
				reachable: false,
				binding: "insufficientMoney",
				bestCase: { month: "2026-01-01", runsOut: { date: "2026-12-31", unmet: 500 } },
			},
		})
	})
})
