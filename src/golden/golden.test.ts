import { describe, expect, it } from "bun:test"
import { project } from "../engine/project"
import { income } from "../engine/test-flows"
import { amounts, makeFixture, rowAt, run } from "../engine/test-helpers"
import type { Fixture } from "../fixtures/fixture"
import { freelancer } from "../fixtures/freelancer"
import { thaiEmployee } from "../fixtures/thai-employee"
import type { Projection } from "../types/projection"
import { oracleView } from "./oracle-view"

function runFixture(fixture: Fixture): Projection {
	const result = project(fixture.baseline, fixture.scenario, fixture.timeline)
	if (!result.ok) throw new Error(JSON.stringify(result.problems))
	return result.projection
}

function expectOracleMatch(fixture: Fixture, projection: Projection): void {
	const view = oracleView(
		fixture,
		projection.rows.map((row) => row.date),
	)
	expect(projection.rows).toEqual(view.rows)
	expect(projection.runsOut).toEqual(view.runsOut)
	expect(projection.annual).toEqual(view.annual)
	expect(projection.unfundedContributions).toEqual(view.unfundedContributions)
}

function monthly(fixture: Fixture): Fixture {
	return { ...fixture, timeline: { ...fixture.timeline, resolution: "month" } }
}

describe("golden fixtures match the independent oracle", () => {
	it("freelancer", () => {
		const fixture = monthly(freelancer)
		expectOracleMatch(fixture, runFixture(fixture))
	})

	it("thai employee", () => {
		expectOracleMatch(thaiEmployee, runFixture(thaiEmployee))
	})
})

describe("hand-computed opening rows", () => {
	it("freelancer pays the start-date living expense from cash", () => {
		const projection = runFixture(freelancer)
		const row = rowAt(projection, "2026-01-01")
		expect(amounts(row)).toEqual({
			brokerage: 0,
			cash: 12_800_000,
			"equipment-loan": 9_000_000,
			ssf: 8_000_000,
			"tax-reserve": 2_000_000,
		})
		expect(row.netWorth).toBe(13_800_000)
		expect(row.accessibleNetWorth).toBe(5_800_000)
		expect(row.realNetWorth).toBe(13_800_000)
	})

	it("thai employee pays the start-date living expense from the emergency fund", () => {
		const projection = runFixture(thaiEmployee)
		const row = rowAt(projection, "2026-01-01")
		expect(amounts(row)).toEqual({
			cash: 5_000_000,
			"emergency-fund": 27_500_000,
			mortgage: 250_000_000,
			rmf: 20_000_000,
		})
		expect(row.netWorth).toBe(-197_500_000)
		expect(row.accessibleNetWorth).toBe(-217_500_000)
	})
})

describe("small purpose-built golden cases", () => {
	it("clamps a day-31 monthly flow across leap February", () => {
		const setup = {
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			balances: { cash: 0 },
			flows: [income("pay", 100, { frequency: "monthly", start: "2024-01-31" })],
			surplus: [{ account: "cash" }],
			start: "2024-01-31",
			horizon: "2024-04-30",
			resolution: "month",
		} as const
		const projection = run(setup)
		expect(projection.rows.map((row) => [row.date, amounts(row)["cash"]])).toEqual([
			["2024-01-31", 100],
			["2024-02-29", 200],
			["2024-03-31", 300],
			["2024-04-30", 400],
		])
		expect(projection.annual).toEqual([
			{
				index: 0,
				from: "2024-01-31",
				to: "2024-04-30",
				openingNetWorth: 0,
				closingNetWorth: 400,
				income: 400,
				expense: 0,
				contributions: 0,
				unfundedContributions: 0,
				interest: 0,
				unmet: 0,
				partial: true,
			},
		])
		expectOracleMatch(makeFixture(setup), projection)
	})

	it("grows 1 at 5000 bps for one year to the half-up tie of 2", () => {
		const setup = {
			accounts: [{ id: "cash", kind: "asset", rate: 5000 }],
			balances: { cash: 1 },
			surplus: [{ account: "cash" }],
			horizon: "2027-01-01",
			resolution: "month",
		} as const
		const projection = run(setup)
		expect(amounts(rowAt(projection, "2027-01-01"))).toEqual({ cash: 2 })
		expect(projection.annual.map((year) => [year.from, year.to, year.closingNetWorth])).toEqual([
			["2026-01-01", "2026-12-31", 1],
			["2027-01-01", "2027-01-01", 2],
		])
		expect(projection.annual[1]).toMatchObject({ interest: 1, partial: true })
		expectOracleMatch(makeFixture(setup), projection)
	})
})
