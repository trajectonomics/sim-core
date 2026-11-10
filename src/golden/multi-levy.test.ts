import { describe, expect, it } from "bun:test"
import { project } from "../engine/project"
import { income, prepays } from "../engine/test-flows"
import { makeFixture, withCarryIn } from "../engine/test-helpers"
import type { Fixture } from "../fixtures/fixture"
import type { DateString, Levy, Projection, SettlementPeriod } from "../types"
import { oracleMeasures } from "./oracle-measure"
import { oracleIncomeEvents, oraclePrepaidByLevy, oracleTallies } from "./oracle-prepayment"

const empty = (periodStart: DateString) => ({ periodStart, tallies: [], prepaid: 0 })

function levy(id: string, percent: number, settlement: { month: number; day: number }): Levy {
	return withCarryIn(
		{
			id,
			period: { month: 1, day: 1 },
			settlement,
			measures: [
				{ id: "gross", op: "tally", label: "salary", basis: "gross" },
				{ id: "due", op: "scale", of: "gross", num: percent, den: 100, rounding: "halfUp" },
			],
			due: "due",
		},
		empty("2025-01-01"),
	)
}

const fixture: Fixture = makeFixture({
	accounts: [{ id: "cash", kind: "asset", rate: 0 }],
	balances: { cash: 0 },
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	horizon: "2027-12-31",
	levies: [levy("a", 10, { month: 3, day: 31 }), levy("b", 5, { month: 6, day: 30 })],
	flows: [
		income("salary", 1_000_000, {
			frequency: "monthly",
			start: "2026-01-31",
			label: "salary",
			prepayments: [...prepays("a", 300), ...prepays("b", 200)],
		}),
	],
})

function projected(): Projection {
	const result = project(fixture.baseline, fixture.scenario, fixture.timeline)
	if (!result.ok) throw new Error(JSON.stringify(result.problems))
	return result.projection
}

function periodOf(projection: Projection, id: string, from: DateString): SettlementPeriod {
	const report = projection.levies?.find((item) => item.id === id)
	const period = report?.periods.find((item) => item.from === from)
	if (period === undefined) throw new Error(`Missing ${id} period ${from}`)
	return period
}

function expectOracle(period: SettlementPeriod, levyId: string): void {
	const levy = fixture.scenario.levies?.find((item) => item.id === levyId)
	if (levy === undefined) throw new Error("Fixture has no Levy")
	const incomes = oracleIncomeEvents(fixture, period.from, period.to, period.settlementDate)
	const order = fixture.scenario.levies?.map((item) => item.id) ?? []
	const inflation = fixture.scenario.economy.inflation
	const oracle = oracleMeasures(
		levy,
		oracleTallies(incomes),
		period.settlementDate,
		inflation,
		period.to,
	)
	for (const measure of period.measures) {
		expect([measure.id, measure.value]).toEqual([measure.id, Number(oracle.values.get(measure.id))])
	}
	expect(period.due).toBe(Number(oracle.due))
	expect(period.prepaid).toBe(Number(oraclePrepaidByLevy(incomes, order).get(levyId) ?? 0n))
}

describe("golden cases for several Levies", () => {
	it("gives each Levy its own due and its own Prepayment", () => {
		const projection = projected()
		const first = periodOf(projection, "a", "2026-01-01")
		const second = periodOf(projection, "b", "2026-01-01")
		// 12 x 1,000,000 gross at 10% and 5%.
		expect(first.due).toBe(1_200_000)
		expect(second.due).toBe(600_000)
		// 300 bps of each 1,000,000, then the cumulative 500 bps less the first share.
		expect(first.prepaid).toBe(360_000)
		expect(second.prepaid).toBe(240_000)
		expectOracle(first, "a")
		expectOracle(second, "b")
	})

	it("splits the odd tie without taking more than the gross", () => {
		const odd: Fixture = {
			...fixture,
			scenario: {
				...fixture.scenario,
				levies: [levy("a", 0, { month: 3, day: 31 }), levy("b", 0, { month: 3, day: 31 })],
				flows: [
					income("salary", 1, {
						start: "2026-01-31",
						label: "salary",
						prepayments: [...prepays("a", 5000), ...prepays("b", 5000)],
					}),
				],
			},
			timeline: { ...fixture.timeline, horizon: "2026-12-31" },
		}
		const result = project(odd.baseline, odd.scenario, odd.timeline)
		if (!result.ok) throw new Error(JSON.stringify(result.problems))
		const from = periodOf(result.projection, "a", "2026-01-01").from
		const projection = result.projection
		expect(periodOf(projection, "a", from).prepaid).toBe(1)
		expect(periodOf(projection, "b", from).prepaid).toBe(0)
		const incomes = oracleIncomeEvents(odd, from, "2026-12-31", from)
		const shares = oraclePrepaidByLevy(incomes, ["a", "b"])
		expect([shares.get("a"), shares.get("b")]).toEqual([1n, 0n])
	})
})
