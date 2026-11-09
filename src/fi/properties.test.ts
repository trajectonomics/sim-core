import { describe, expect, it } from "bun:test"
import { project } from "../engine/project"
import { expense, income } from "../engine/test-flows"
import { makeFixture } from "../engine/test-helpers"
import type { Fixture } from "../fixtures/fixture"
import { freelancer } from "../fixtures/freelancer"
import { thaiEmployee } from "../fixtures/thai-employee"
import { oracleCalendar } from "../golden/oracle-calendar"
import { oracleCutFlows } from "../golden/oracle-fi"
import { financialIndependence } from "../index"
import type { SurvivalOptions } from "../types"
import { candidateMonths } from "./candidates"

function fi(fixture: Fixture, options: SurvivalOptions = { method: "survival" }) {
	return financialIndependence(fixture.baseline, fixture.scenario, fixture.timeline, options)
}

function rewritten(fixture: Fixture, month: string): Fixture {
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

/** A naive scan through `project()` after stopping earned flows at M. */
function rewrittenMonth(fixture: Fixture): string | undefined {
	for (const month of candidateMonths(fixture.timeline)) {
		const { baseline, scenario, timeline } = rewritten(fixture, month)
		const result = project(baseline, scenario, timeline)
		if (result.ok && result.projection.runsOut === undefined) return month
	}
	return undefined
}

function reachedMonth(result: ReturnType<typeof financialIndependence>): string | undefined {
	if (!result.ok || !result.financialIndependence.reachable) return undefined
	return result.financialIndependence.month
}

function withHorizon(fixture: Fixture, horizon: string): Fixture {
	return { ...fixture, timeline: { ...fixture.timeline, horizon, resolution: "month" } }
}

describe("survival properties", () => {
	it.each([
		["freelancer", withHorizon(freelancer, "2040-01-01"), "2030-12-01"],
		["thai employee", withHorizon(thaiEmployee, "2040-01-01"), "2035-08-01"],
	] as const)("matches a hand-rewritten Scenario for %s", (_name, fixture, expected) => {
		expect(reachedMonth(fi(fixture))).toBe(expected)
		expect(rewrittenMonth(fixture)).toBe(expected)
	})

	it("returns the earliest pass even when a later month would fail", () => {
		const result = fi(
			makeFixture({
				accounts: [{ id: "cash", kind: "asset", rate: 0 }],
				balances: { cash: 1000 },
				flows: [
					expense("large-once", 5000, { start: "2026-01-10" }),
					expense("living", 100, { frequency: "monthly" }),
				],
				surplus: [{ account: "cash" }],
				withdraw: ["cash"],
				horizon: "2026-03-01",
			}),
			{ method: "survival", retirementSpending: { amount: 100, growth: { bps: 0 } } },
		)
		expect(result).toMatchObject({
			ok: true,
			financialIndependence: { reachable: true, month: "2026-01-01" },
		})
	})

	it("stays inside the last supported year without hanging", () => {
		const fixture = makeFixture({
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			balances: { cash: 1_000_000 },
			flows: [expense("living", 100, { frequency: "monthly", start: "9998-01-01" })],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			start: "9998-01-01",
			horizon: "9998-12-31",
		})
		expect(fi(fixture)).toMatchObject({
			ok: true,
			financialIndependence: { reachable: true, month: "9998-01-01" },
		})
	})

	it("does not depend on flow order", () => {
		const fixture = withHorizon(freelancer, "2035-01-01")
		const shuffled: Fixture = {
			...fixture,
			scenario: { ...fixture.scenario, flows: [...fixture.scenario.flows].reverse() },
		}
		expect(fi(shuffled)).toEqual(fi(fixture))
	})

	it("returns the same answer for day and month resolutions", () => {
		const base = makeFixture({
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			balances: { cash: 1200 },
			flows: [
				income("pay", 110, { frequency: "monthly" }),
				expense("living", 100, { frequency: "monthly" }),
			],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2026-12-31",
		})
		const day = fi({ ...base, timeline: { ...base.timeline, resolution: "day" } })
		const month = fi({ ...base, timeline: { ...base.timeline, resolution: "month" } })
		expect(day).toEqual(month)
	})
})
