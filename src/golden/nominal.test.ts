import { describe, expect, it } from "bun:test"
import { project } from "../engine/project"
import type { Fixture } from "../fixtures/fixture"
import type { Projection } from "../types/projection"
import { NOMINAL_CASES } from "./nominal-cases"
import { FLOW_NOMINAL_CASES } from "./nominal-flow-cases"

const ALL_CASES: readonly Fixture[] = [...NOMINAL_CASES, ...FLOW_NOMINAL_CASES]

import { oracleView } from "./oracle-view"

function projectFixture(fixture: Fixture): Projection {
	const result = project(fixture.baseline, fixture.scenario, fixture.timeline)
	if (!result.ok) throw new Error(JSON.stringify(result.problems))
	return result.projection
}

describe("nominal fixtures match the independent oracle", () => {
	for (const [index, fixture] of ALL_CASES.entries()) {
		it(`case ${index + 1} matches rows, roll-ups and runs-out`, () => {
			const projection = projectFixture(fixture)
			const view = oracleView(
				fixture,
				projection.rows.map((row) => row.date),
			)
			expect(projection.rows).toEqual(view.rows)
			expect(projection.runsOut).toEqual(view.runsOut)
			expect(projection.annual).toEqual(view.annual)
			expect(projection.unfundedContributions).toEqual(view.unfundedContributions)
		})
	}
})

describe("split invariants", () => {
	it("holds capitalised + accruedInterest = amount on every nominal and real row", () => {
		for (const fixture of ALL_CASES) {
			const projection = projectFixture(fixture)
			for (const row of projection.rows) {
				for (const balance of [...row.balances, ...row.realBalances]) {
					expect(balance.capitalised + balance.accruedInterest).toBe(balance.amount)
					expect(balance.amount).toBeGreaterThanOrEqual(0)
				}
			}
		}
	})
})
