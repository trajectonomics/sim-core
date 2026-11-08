import { describe, expect, it } from "bun:test"
import { expense, income } from "../engine/test-flows"
import { emptyCarryIn, makeFixture, withCarryIn } from "../engine/test-helpers"
import { financialIndependence } from "../index"
import type { Levy } from "../types"

const incomeLevy: Levy = {
	id: "income",
	period: { month: 1, day: 1 },
	settlement: { month: 6, day: 30 },
	measures: [{ id: "income", op: "tally", label: "salary", basis: "gross" }],
	due: "income",
}

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

	it("recomputes the Levy for each candidate", () => {
		const setup = {
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			balances: { cash: 0 },
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2027-06-30",
		} as const
		const withLevy = makeFixture({
			...setup,
			flows: [
				income("salary", 1000, { frequency: "monthly", label: "salary" }),
				expense("living", 100, { frequency: "monthly" }),
			],
			levy: withCarryIn(incomeLevy, emptyCarryIn("2025-01-01")),
		})
		const withoutLevy = makeFixture({
			...setup,
			flows: [
				income("salary", 1000, { frequency: "monthly" }),
				expense("living", 100, { frequency: "monthly" }),
			],
		})
		expect(
			financialIndependence(withLevy.baseline, withLevy.scenario, withLevy.timeline, {
				method: "survival",
			}),
		).toMatchObject({
			ok: true,
			financialIndependence: { reachable: true, month: "2027-03-01" },
		})
		expect(
			financialIndependence(withoutLevy.baseline, withoutLevy.scenario, withoutLevy.timeline, {
				method: "survival",
			}),
		).toMatchObject({
			ok: true,
			financialIndependence: { reachable: true, month: "2026-03-01" },
		})
	})
})
