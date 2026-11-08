import { describe, expect, it } from "bun:test"
import { income } from "../engine/test-flows"
import { makeFixture } from "../engine/test-helpers"
import type { Fixture } from "../fixtures/fixture"
import { freelancer } from "../fixtures/freelancer"
import { thaiEmployee } from "../fixtures/thai-employee"
import { financialIndependence } from "../index"
import type { SurvivalOptions } from "../types"
import { oracleFiMonth } from "./oracle-fi"

function shortened(fixture: Fixture, horizon: string): Fixture {
	return { ...fixture, timeline: { ...fixture.timeline, horizon, resolution: "month" } }
}

const retirement = makeFixture({
	accounts: [{ id: "cash", kind: "asset", rate: 0 }],
	balances: { cash: 0 },
	flows: [income("pay", 100, { frequency: "monthly" })],
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	horizon: "2028-01-01",
	inflation: 1000,
})

const cases: readonly (readonly [string, Fixture, SurvivalOptions])[] = [
	["freelancer", shortened(freelancer, "2040-01-01"), { method: "survival" }],
	["thai employee", shortened(thaiEmployee, "2040-01-01"), { method: "survival" }],
	[
		"retirement spending",
		retirement,
		{ method: "survival", retirementSpending: { amount: 200, growth: "inflation" } },
	],
]

describe("financialIndependence matches the independent FI oracle", () => {
	it.each(cases)("%s", (_name, fixture, options) => {
		const result = financialIndependence(
			fixture.baseline,
			fixture.scenario,
			fixture.timeline,
			options,
		)
		const expected = oracleFiMonth(fixture, options)
		if (expected === undefined) {
			expect(result).toMatchObject({
				ok: true,
				financialIndependence: { reachable: false },
			})
			return
		}
		expect(result).toMatchObject({
			ok: true,
			financialIndependence: { reachable: true, month: expected },
		})
	})
})
