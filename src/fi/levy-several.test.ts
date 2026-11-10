import { describe, expect, it } from "bun:test"
import { addDays, addMonthsClamped } from "../calendar/arith"
import { project } from "../engine/project"
import { expense, income } from "../engine/test-flows"
import { makeFixture } from "../engine/test-helpers"
import type { Fixture } from "../fixtures/fixture"
import { financialIndependence } from "../index"
import type { Flow, Levy, Scenario } from "../types"

const empty = (periodStart: string) => ({ periodStart, tallies: [], prepaid: 0 })

function smallLevy(id: string, settlement: { month: number; day: number }): Levy {
	return {
		id,
		period: { month: 1, day: 1 },
		settlement,
		measures: [{ id: "due", op: "const", value: 100 }],
		due: "due",
		carryIn: [empty("2025-01-01")],
	}
}

const fixture: Fixture = makeFixture({
	accounts: [{ id: "cash", kind: "asset", rate: 0 }],
	balances: { cash: 0 },
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	start: "2026-01-01",
	horizon: "2027-12-31",
	resolution: "month",
	levies: [smallLevy("national", { month: 3, day: 31 }), smallLevy("local", { month: 6, day: 30 })],
	flows: [
		income("salary", 1_000, { frequency: "monthly", start: "2026-01-01", end: "2026-12-31" }),
		expense("food", 400, { frequency: "monthly", start: "2026-01-01" }),
	],
})

/** The earned income stops on the day before `month`. */
function stopEarned(flows: readonly Flow[], month: string): readonly Flow[] {
	const last = addDays(month, -1)
	return flows.map((flow) =>
		flow.kind === "income" && flow.earned ? { ...flow, end: last } : flow,
	)
}

function survivesFrom(month: string): boolean {
	const scenario: Scenario = {
		...fixture.scenario,
		flows: stopEarned(fixture.scenario.flows, month),
	}
	const result = project(fixture.baseline, scenario, fixture.timeline)
	return result.ok && result.projection.runsOut === undefined
}

describe("Levy settlements in the survival walk with two Levies", () => {
	it("reaches the month a brute-force stop reaches", () => {
		const { baseline, scenario, timeline } = fixture
		const result = financialIndependence(baseline, scenario, timeline, { method: "survival" })
		if (!result.ok || !result.financialIndependence.reachable) throw new Error("Expected a month")
		const month = result.financialIndependence.month
		// 600 a month saved through 11 months covers 400 a month for the remaining fourteen.
		expect(month).toBe("2026-11-01")
		expect(survivesFrom(month)).toBe(true)
		expect(survivesFrom(addMonthsClamped(month, -1))).toBe(false)
	})
})
