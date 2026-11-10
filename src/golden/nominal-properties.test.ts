import { describe, expect, it } from "bun:test"
import { project } from "../engine/project"
import { expense } from "../engine/test-flows"
import { makeFixture } from "../engine/test-helpers"
import type { Fixture } from "../fixtures/fixture"
import type { Projection, ProjectionRow } from "../types/projection"
import { nominalMonthlyLoan } from "./nominal-flow-cases"

function projectFixture(fixture: Fixture): Projection {
	const result = project(fixture.baseline, fixture.scenario, fixture.timeline)
	if (!result.ok) throw new Error(JSON.stringify(result.problems))
	return result.projection
}

function reordered(fixture: Fixture): Fixture {
	return {
		baseline: { ...fixture.baseline, balances: [...fixture.baseline.balances].reverse() },
		scenario: {
			...fixture.scenario,
			accounts: [...fixture.scenario.accounts].reverse(),
			flows: [...fixture.scenario.flows].reverse(),
		},
		timeline: fixture.timeline,
	}
}

function balanceByDate(projection: Projection): ReadonlyMap<string, ProjectionRow> {
	return new Map(projection.rows.map((row) => [row.date, row]))
}

describe("nominal properties", () => {
	it("reports the same balances at day and month resolution", () => {
		const monthly = projectFixture(nominalMonthlyLoan)
		const day = projectFixture({
			...nominalMonthlyLoan,
			timeline: { ...nominalMonthlyLoan.timeline, resolution: "day" },
		})
		const daily = balanceByDate(day)
		expect(monthly.rows.length).toBeGreaterThan(10)
		for (const row of monthly.rows) expect(daily.get(row.date)).toEqual(row)
	})

	it("ignores the order of accounts, flows and baseline balances", () => {
		expect(projectFixture(reordered(nominalMonthlyLoan))).toEqual(
			projectFixture(nominalMonthlyLoan),
		)
	})

	it("changes no number when a zero-amount Flow lands", () => {
		const withZero: Fixture = {
			...nominalMonthlyLoan,
			scenario: {
				...nominalMonthlyLoan.scenario,
				flows: [
					...nominalMonthlyLoan.scenario.flows,
					expense("nothing", 0, { start: "2026-01-20" }),
				],
			},
		}
		expect(projectFixture(withZero)).toEqual(projectFixture(nominalMonthlyLoan))
	})
})

describe("nominal timing", () => {
	it("runs a 30-year day-resolution monthly-compounding projection in under one second", () => {
		const fixture = makeFixture({
			accounts: [{ id: "savings", kind: "asset", rate: 1200, compounding: "monthly" }],
			balances: { savings: 1_000_000 },
			surplus: [{ account: "savings" }],
			start: "2026-01-01",
			horizon: "2056-01-01",
			resolution: "day",
		})
		const started = performance.now()
		const projection = projectFixture(fixture)
		const elapsed = performance.now() - started
		expect(projection.rows).toHaveLength(10_958)
		expect(elapsed).toBeLessThan(1000)
	})
})
