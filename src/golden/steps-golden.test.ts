import { describe, expect, it } from "bun:test"
import { project } from "../engine/project"
import { emptyCarryIn, makeFixture, withCarryIn } from "../engine/test-helpers"
import type { Fixture } from "../fixtures/fixture"
import type { Levy, Projection } from "../types"
import { oracleMeasures } from "./oracle-measure"

const levy: Levy = withCarryIn(
	{
		id: "stepped",
		period: { month: 1, day: 1 },
		settlement: { month: 3, day: 31 },
		measures: [
			{ id: "floor", op: "const", value: 1_000 },
			{
				id: "due",
				op: "const",
				value: 100,
				steps: [
					{ from: "2026-06-01", value: 200 },
					{ from: "2027-03-31", value: 300 },
					{ from: "2028-01-01", value: 400 },
				],
			},
		],
		due: "due",
	},
	emptyCarryIn("2025-01-01"),
)

const fixture: Fixture = makeFixture({
	accounts: [{ id: "cash", kind: "asset", rate: 0 }],
	balances: { cash: 10_000 },
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	start: "2026-01-01",
	horizon: "2028-12-31",
	resolution: "month",
	levy,
})

function projected(): Projection {
	const result = project(fixture.baseline, fixture.scenario, fixture.timeline)
	if (!result.ok) throw new Error(JSON.stringify(result.problems))
	return result.projection
}

describe("golden cases for Dated constants", () => {
	it("reports each period's stepped value and the oracle agrees", () => {
		const projection = projected()
		const periods = projection.levies?.[0]?.periods ?? []
		// 2026 reads its last day; 2027 reads 300, a step on that year's Settlement date not reopening it.
		const dues = periods.map((period) => [period.from, period.due])
		expect(dues).toEqual([
			["2025-01-01", 100],
			["2026-01-01", 200],
			["2027-01-01", 300],
			["2028-01-01", 400],
		])
		const inflation = fixture.scenario.economy.inflation
		for (const period of periods) {
			const oracle = oracleMeasures(
				levy,
				{ gross: new Map(), funded: new Map() },
				period.settlementDate,
				inflation,
				period.to,
			)
			expect(period.due).toBe(Number(oracle.due))
			expect(period.measures).toEqual([
				{ id: "floor", value: 1_000 },
				{ id: "due", value: period.due },
			])
		}
	})
})
