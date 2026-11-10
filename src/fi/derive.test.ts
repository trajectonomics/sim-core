import { describe, expect, it } from "bun:test"
import { addDays, addMonthsClamped } from "../calendar/arith"
import { project } from "../engine/project"
import { derivedContribution, derivedExpense, expense, income } from "../engine/test-flows"
import { makeFixture } from "../engine/test-helpers"
import type { Fixture } from "../fixtures/fixture"
import { financialIndependence } from "../index"
import type { Derive, Flow, Scenario, SurvivalOptions } from "../types"

function portion(flow: string, percent: number): Derive {
	return {
		measures: [
			{ id: "source", op: "flow", flow },
			{ id: "result", op: "scale", of: "source", num: percent, den: 100, rounding: "halfUp" },
		],
		result: "result",
	}
}

/** The earned income stops on the day before `month`. */
function stopEarned(flows: readonly Flow[], month: string): readonly Flow[] {
	const last = addDays(month, -1)
	return flows.map((flow) =>
		flow.kind === "income" && flow.earned ? { ...flow, end: last } : flow,
	)
}

function survivesFrom(fixture: Fixture, month: string, stop = true): boolean {
	const flows = stop ? stopEarned(fixture.scenario.flows, month) : fixture.scenario.flows
	const scenario: Scenario = { ...fixture.scenario, flows }
	const result = project(fixture.baseline, scenario, fixture.timeline)
	return result.ok && result.projection.runsOut === undefined
}

const contributionCase: Fixture = makeFixture({
	accounts: [
		{ id: "cash", kind: "asset", rate: 0 },
		{ id: "savings", kind: "asset", rate: 0 },
	],
	balances: { cash: 0 },
	surplus: [{ account: "cash" }],
	contribute: ["savings"],
	withdraw: ["cash"],
	start: "2026-01-01",
	horizon: "2026-12-31",
	resolution: "month",
	flows: [
		income("salary", 1_000, { frequency: "monthly", start: "2026-01-01" }),
		expense("food", 500, { frequency: "monthly", start: "2026-01-01" }),
		// 30% of salary: cash keeps 200 a month that can cover expenses once salary stops.
		derivedContribution("save", "savings", portion("salary", 30), {
			frequency: "monthly",
			start: "2026-01-01",
		}),
	],
})

describe("Derived Flows in the Financial Independence scan", () => {
	it("finds the month a brute-force stop reaches", () => {
		const fixture = contributionCase
		const { baseline, scenario, timeline } = fixture
		const options: SurvivalOptions = { method: "survival" }
		const result = financialIndependence(baseline, scenario, timeline, options)
		if (!result.ok || !result.financialIndependence.reachable) throw new Error("Expected a month")
		const month = result.financialIndependence.month
		expect(month).toBe("2026-10-01")
		expect(survivesFrom(fixture, month)).toBe(true)
		expect(survivesFrom(fixture, addMonthsClamped(month, -1))).toBe(false)
	})

	it("rejects a derived expense that reads earned income, unless retirement spending replaces it", () => {
		const fixture = makeFixture({
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			balances: { cash: 0 },
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2026-12-31",
			flows: [
				income("salary", 1_000, { frequency: "monthly", start: "2026-01-01" }),
				derivedExpense("rent", portion("salary", 30), {
					frequency: "monthly",
					start: "2026-01-01",
				}),
			],
		})
		const { baseline, scenario, timeline } = fixture
		expect(financialIndependence(baseline, scenario, timeline, { method: "survival" })).toEqual({
			ok: false,
			problems: [
				{ code: "DERIVED_EXPENSE_READS_EARNED", path: ["scenario", "flows", 1, "derive"] },
			],
		})
		const replaced = financialIndependence(baseline, scenario, timeline, {
			method: "survival",
			retirementSpending: { amount: 100, growth: "inflation" },
		})
		expect(replaced.ok).toBe(true)
	})

	it("measures a derived passive expense in the buffer and the 25x reference", () => {
		const fixture = makeFixture({
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			balances: { cash: 900 },
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			start: "2026-01-01",
			horizon: "2026-12-31",
			resolution: "month",
			flows: [
				income("yield", 1_000, { frequency: "monthly", start: "2026-01-01", earned: false }),
				derivedExpense("fee", portion("yield", 10), { frequency: "monthly", start: "2026-01-01" }),
			],
		})
		const { baseline, scenario, timeline } = fixture
		const result = financialIndependence(baseline, scenario, timeline, {
			method: "survival",
			minBufferMonths: 6,
		})
		if (!result.ok || !result.financialIndependence.reachable) throw new Error("Expected a month")
		// 10% of 1,000 is 100 a month, so 1,200 a year; six months of that is a 600 buffer.
		expect(result.financialIndependence.reference.annualExpenses).toBe(1_200)
		expect(result.financialIndependence.reference.threshold).toBe(30_000)
		// The 900 held before the candidate against 1,200 a year: 7,500 bps against the threshold.
		expect(result.financialIndependence.reference.multipleBps).toBe(7_500)
		expect(result.financialIndependence.reference.met).toBe(false)
	})

	it("returns an overflowing derived expense as data, not a throw", () => {
		const big = Number.MAX_SAFE_INTEGER
		const fixture = makeFixture({
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			balances: { cash: 0 },
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2026-12-31",
			flows: [
				income("yield", big, { start: "2026-01-01", earned: false }),
				derivedExpense("fee", portion("yield", 200), { start: "2026-01-01" }),
			],
		})
		const { baseline, scenario, timeline } = fixture
		expect(financialIndependence(baseline, scenario, timeline, { method: "survival" })).toEqual({
			ok: false,
			problems: [{ code: "VALUE_OVERFLOW", date: "2026-01-01" }],
		})
	})
})
