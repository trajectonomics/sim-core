import { describe, expect, it } from "bun:test"
import { project } from "../engine/project"
import type { Fixture } from "../fixtures/fixture"
import { calendarFiMonth } from "../golden/calendar-cases"
import { oracleCalendar } from "../golden/oracle-calendar"
import { oracleCutFlows } from "../golden/oracle-fi"
import { financialIndependence } from "../index"
import type { SurvivalOptions } from "../types"

const options: SurvivalOptions = { method: "survival" }

function reachedMonth(fixture: Fixture): string | undefined {
	const result = financialIndependence(
		fixture.baseline,
		fixture.scenario,
		fixture.timeline,
		options,
	)
	if (!result.ok || !result.financialIndependence.reachable) return undefined
	return result.financialIndependence.month
}

/** The equivalent candidate Scenario: earned income stops after the last Due date that landed before `month`. */
function candidate(fixture: Fixture, month: string): Fixture {
	const calendar = oracleCalendar(fixture)
	return {
		...fixture,
		scenario: {
			...fixture.scenario,
			flows: fixture.scenario.flows.flatMap((flow) =>
				flow.kind === "income" && flow.earned ? oracleCutFlows(flow, month, calendar) : [flow],
			),
		},
	}
}

function survives(fixture: Fixture): boolean {
	const result = project(fixture.baseline, fixture.scenario, fixture.timeline)
	return result.ok && result.projection.runsOut === undefined
}

describe("the FI scan lands on the same dates", () => {
	const current = calendarFiMonth.scenario.flows[0]!

	it("stops the salary due Saturday 31 January from the February candidate", () => {
		// It lands on 2026-02-02, so no Due date in January lands before February.
		expect(oracleCutFlows(current, "2026-02-01", oracleCalendar(calendarFiMonth))).toEqual([])
	})

	it("keeps the January salary from the March candidate, at the last Due date that lands before it", () => {
		expect(oracleCutFlows(current, "2026-03-01", oracleCalendar(calendarFiMonth))).toEqual([
			{ ...current, end: "2026-02-27" },
		])
	})

	it("reaches the first month whose equivalent candidate Scenario survives", () => {
		expect(reachedMonth(calendarFiMonth)).toBe("2029-12-01")
		expect(survives(candidate(calendarFiMonth, "2029-11-01"))).toBe(false)
		expect(survives(candidate(calendarFiMonth, "2029-12-01"))).toBe(true)
	})
})
