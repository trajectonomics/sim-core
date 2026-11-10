import { describe, expect, it } from "bun:test"
import { project } from "../engine/project"
import type { Fixture } from "../fixtures/fixture"
import type { Levy, Projection, SettlementPeriod } from "../types"
import { levyJointFilers, levyWageBaseStraddle, wageBaseCase } from "./levy-cap-cases"
import { levyAotc, levyCareCredit } from "./levy-us-cases"
import { oracleMeasures } from "./oracle-measure"
import { oracleIncomeEvents, oraclePrepaid, oracleTallies } from "./oracle-prepayment"

function projected(fixture: Fixture): Projection {
	const result = project(fixture.baseline, fixture.scenario, fixture.timeline)
	if (!result.ok) throw new Error(JSON.stringify(result.problems))
	return result.projection
}

function periodOf(fixture: Fixture): SettlementPeriod {
	const period = projected(fixture).levy?.periods.find((item) => item.from === "2026-01-01")
	if (period === undefined) throw new Error("Missing the 2026 Settlement period")
	return period
}

function levyOf(fixture: Fixture): Levy {
	const levy = fixture.scenario.levy
	if (levy === undefined) throw new Error("Fixture has no Levy")
	return levy
}

function measureValueOf(period: SettlementPeriod, id: string): number | undefined {
	return period.measures.find((measure) => measure.id === id)?.value
}

/** Every reported Measure, the `due` and the `prepaid` against the independent Levy oracle. */
function expectOracle(fixture: Fixture, period: SettlementPeriod): void {
	const incomes = oracleIncomeEvents(fixture, period.from, period.to, period.settlementDate)
	const oracle = oracleMeasures(
		levyOf(fixture),
		oracleTallies(incomes),
		period.settlementDate,
		fixture.scenario.economy.inflation,
	)
	for (const measure of period.measures) {
		const value = oracle.values.get(measure.id)
		if (value === undefined) throw new Error(`Oracle is missing ${measure.id}`)
		expect([measure.id, measure.value]).toEqual([measure.id, Number(value)])
	}
	expect(period.due).toBe(Number(oracle.due))
	expect(period.prepaid).toBe(Number(oraclePrepaid(incomes)))
}

describe("golden cases for the US-style Levy operations", () => {
	it("multiplies a derived care base by a derived rate", () => {
		const period = periodOf(levyCareCredit)
		// 12 * 1,000,000 of care, rate 1,800 - 120,000,000 / 100,000 = 600 bps.
		expect(measureValueOf(period, "rate")).toBe(600)
		expect(measureValueOf(period, "credit")).toBe(720_000)
		expect(period.due).toBe(720_000)
		expectOracle(levyCareCredit, period)
	})

	it("multiplies a tuition credit by a linearly phased-out factor", () => {
		const period = periodOf(levyAotc)
		// Salary 180,000,000 is 20 steps of 1,000,000 over 160,000,000, so the factor is 9,980 bps.
		expect(measureValueOf(period, "steps")).toBe(20)
		expect(measureValueOf(period, "factor")).toBe(9_980)
		expect(period.due).toBe(4_990_000)
		expectOracle(levyAotc, period)
	})

	it("caps Social Security Prepayment at a wage base", () => {
		const fixture = wageBaseCase(60_000_000)
		const period = periodOf(fixture)
		// Six whole months of 10,000,000 at 6.2%: the year's Prepayment is 6.2% of the base.
		expect(period.prepaid).toBe(3_720_000)
		expectOracle(fixture, period)
	})

	it("prepays 6.2% of an $181,800 wage base across a straddling Occurrence", () => {
		const fixture = wageBaseCase(18_180_000)
		const period = periodOf(fixture)
		// The first month takes 620,000; the second takes 6.2% of the 8,180,000 left: 507,160.
		expect(period.prepaid).toBe(1_127_160)
		expectOracle(fixture, period)
	})

	it("prepays only the part of a straddling Occurrence below the cap", () => {
		const period = periodOf(levyWageBaseStraddle)
		// 620,000 + 620,000, then 310,000 on the last 5,000,000 below the 25,000,000 base.
		expect(period.prepaid).toBe(1_550_000)
		expectOracle(levyWageBaseStraddle, period)
	})

	it("gives each person their own label and cap, summed by add", () => {
		const period = periodOf(levyJointFilers)
		// A reaches the 60,000,000 base, B stays below it at 48,000,000.
		expect(measureValueOf(period, "a-due")).toBe(12_000_000)
		expect(measureValueOf(period, "b-due")).toBe(4_800_000)
		expect(period.due).toBe(16_800_000)
		expect(period.prepaid).toBe(6_696_000)
		expect(period.settlement).toBe(10_104_000)
		expectOracle(levyJointFilers, period)
	})
})
