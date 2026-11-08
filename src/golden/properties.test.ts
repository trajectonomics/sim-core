import { describe, expect, it } from "bun:test"
import { project } from "../engine/project"
import { contribution, income } from "../engine/test-flows"
import { run } from "../engine/test-helpers"
import type { Fixture } from "../fixtures/fixture"
import { freelancer } from "../fixtures/freelancer"
import { thaiEmployee } from "../fixtures/thai-employee"
import type { Account } from "../types"
import type { Projection } from "../types/projection"

function projected(fixture: Fixture): Projection {
	const result = project(fixture.baseline, fixture.scenario, fixture.timeline)
	if (!result.ok) throw new Error(JSON.stringify(result.problems))
	return result.projection
}

function withResolution(fixture: Fixture, resolution: "day" | "month"): Fixture {
	return { ...fixture, timeline: { ...fixture.timeline, resolution } }
}

describe("resolution only selects rows", () => {
	it("gives identical rows on every shared date", () => {
		const monthly = projected(withResolution(freelancer, "month"))
		const daily = projected(withResolution(freelancer, "day"))
		for (const row of monthly.rows) {
			expect(daily.rows.find((item) => item.date === row.date)).toEqual(row)
		}
	})
})

describe("order stability", () => {
	it("is unchanged when flows, accounts and opening balances are reversed", () => {
		const reordered: Fixture = {
			baseline: {
				...freelancer.baseline,
				balances: [...freelancer.baseline.balances].reverse(),
			},
			scenario: {
				...freelancer.scenario,
				accounts: [...freelancer.scenario.accounts].reverse(),
				flows: [...freelancer.scenario.flows].reverse(),
			},
			timeline: { ...freelancer.timeline, resolution: "month" },
		}
		const original = withResolution(freelancer, "month")
		expect(projected(reordered)).toEqual(projected(original))
	})
})

describe("balances and conservation", () => {
	it("never reports a negative account balance", () => {
		for (const fixture of [freelancer, thaiEmployee]) {
			for (const row of projected(fixture).rows) {
				for (const balance of row.balances) expect(balance.amount).toBeGreaterThanOrEqual(0)
			}
		}
	})

	it("conserves net worth in every annual roll-up", () => {
		for (const fixture of [freelancer, thaiEmployee]) {
			for (const year of projected(fixture).annual) {
				expect(year.openingNetWorth + year.income + year.interest - year.expense - year.unmet).toBe(
					year.closingNetWorth,
				)
			}
		}
	})

	it("keeps net worth identical whether income is saved or left in cash", () => {
		const base = {
			accounts: [
				{ id: "cash", kind: "asset", rate: 0 },
				{ id: "savings", kind: "asset", rate: 0 },
			] satisfies readonly Account[],
			balances: { cash: 1000, savings: 0 },
			flows: [income("pay", 100, { start: "2026-01-02" })],
			surplus: [{ account: "cash" }],
			contribute: ["savings"],
			withdraw: ["cash"],
			horizon: "2026-01-02",
		} as const
		const saved = run({
			...base,
			flows: [...base.flows, contribution("save", "savings", 100, { start: "2026-01-02" })],
		})
		const cashOnly = run(base)
		expect(saved.rows.map((row) => row.netWorth)).toEqual(cashOnly.rows.map((row) => row.netWorth))
		expect(saved.annual[0]).toMatchObject({
			openingNetWorth: 1000,
			closingNetWorth: 1100,
			contributions: 100,
			unfundedContributions: 0,
			interest: 0,
		})
	})
})

describe("timing", () => {
	it("runs a 30-year day-resolution projection in under one second", () => {
		const fixture = withResolution(
			{
				...freelancer,
				timeline: { ...freelancer.timeline, horizon: "2056-01-01" },
			},
			"day",
		)
		const started = performance.now()
		const projection = projected(fixture)
		const elapsed = performance.now() - started
		expect(projection.rows).toHaveLength(10_958)
		expect(elapsed).toBeLessThan(1000)
	})
})
