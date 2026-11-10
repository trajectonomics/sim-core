import { describe, expect, it } from "bun:test"
import { project } from "../engine/project"
import type { Fixture } from "../fixtures/fixture"
import { deflate } from "../money/growth"
import type { Projection, ProjectionBalance } from "../types/projection"
import {
	nominalAnnual,
	nominalLeapFebruary,
	nominalPartial,
	nominalQuarterly,
	nominalReal,
	nominalSemiannual,
} from "./nominal-cases"
import { nominalOverdraw, nominalShortfall } from "./nominal-flow-cases"

function projectFixture(fixture: Fixture): Projection {
	const result = project(fixture.baseline, fixture.scenario, fixture.timeline)
	if (!result.ok) throw new Error(JSON.stringify(result.problems))
	return result.projection
}

function balanceAt(projection: Projection, date: string, account: string): ProjectionBalance {
	const row = projection.rows.find((item) => item.date === date)!
	return row.balances.find((item) => item.account === account)!
}

describe("hand-computed nominal rows", () => {
	it.each([
		["quarterly 8% earns 20,000 in a full quarter", nominalQuarterly, "2026-03-31", 1_020_000],
		["semiannual 6% earns 30,000 in a full half-year", nominalSemiannual, "2026-06-30", 1_030_000],
		["annual 7% earns 70,000 in a full year", nominalAnnual, "2026-12-31", 1_070_000],
		["a partial first month earns 5,806", nominalPartial, "2026-01-31", 1_205_806],
		[
			"leap February earns 12,000 and capitalises on Feb 29",
			nominalLeapFebruary,
			"2024-02-29",
			1_212_000,
		],
	] as const)("%s", (_name, fixture: Fixture, date, expected) => {
		const balance = balanceAt(projectFixture(fixture), date, "savings")
		expect(balance.capitalised).toBe(expected)
		expect(balance.accruedInterest).toBe(0)
		expect(balance.amount).toBe(expected)
	})

	it("capitalises an overdrawing payment early and leaves the remainder earning", () => {
		const projection = projectFixture(nominalOverdraw)
		expect(balanceAt(projection, "2026-04-16", "loan")).toEqual({
			account: "loan",
			amount: 3_000,
			capitalised: 3_000,
			accruedInterest: 0,
		})
		expect(balanceAt(projection, "2026-04-30", "loan")).toEqual({
			account: "loan",
			amount: 3_014,
			capitalised: 3_014,
			accruedInterest: 0,
		})
	})

	it("records nominal interest as a deeper Shortfall", () => {
		const projection = projectFixture(nominalShortfall)
		expect(projection.runsOut).toEqual({ date: "2026-01-31", unmet: 10_000 })
	})
})

describe("annual roll-ups", () => {
	it("reports the hand-computed interest for a nominal year", () => {
		const fixture: Fixture = {
			...nominalAnnual,
			timeline: { start: "2025-12-31", horizon: "2026-12-31", resolution: "month" },
		}
		const annual = projectFixture(fixture).annual
		expect(
			annual.map((year) => ({
				from: year.from,
				to: year.to,
				interest: year.interest,
				partial: year.partial,
			})),
		).toEqual([
			{ from: "2025-12-31", to: "2026-12-30", interest: 69_808, partial: false },
			{ from: "2026-12-31", to: "2026-12-31", interest: 192, partial: true },
		])
	})
})

describe("real values deflate the components separately", () => {
	it("rounds 26 and 26 to 25 and 25, while 52 rounds to 51", () => {
		expect(deflate(26n, 200, 365)).toBe(25n)
		expect(deflate(26n, 200, 365)).toBe(25n)
		expect(deflate(52n, 200, 365)).toBe(51n)
	})

	it("sets every real amount to the rounded components, not the rounded total", () => {
		const projection = projectFixture(nominalReal)
		for (const row of projection.rows) {
			for (const real of row.realBalances) {
				expect(real.amount).toBe(real.capitalised + real.accruedInterest)
			}
		}
	})
})
