import { describe, expect, it } from "bun:test"
import { project } from "../engine/project"
import { expense, income } from "../engine/test-flows"
import { emptyCarryIn, makeFixture, periodFrom, withCarryIn } from "../engine/test-helpers"
import { financialIndependence } from "../index"
import type { Levy } from "../types"

const incomeLevy: Levy = {
	id: "income",
	period: { month: 1, day: 1 },
	settlement: { month: 6, day: 30 },
	measures: [{ id: "income", op: "tally", label: "salary", basis: "gross" }],
	due: "income",
}

const levy: Levy = {
	id: "fixed",
	period: { month: 1, day: 1 },
	settlement: { month: 12, day: 31 },
	measures: [{ id: "due", op: "const", value: 1000 }],
	due: "due",
}

describe("Levy settlements in the survival walk", () => {
	it("counts a Settlement inside the horizon", () => {
		const { baseline, scenario, timeline } = makeFixture({
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			balances: { cash: 500 },
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2026-12-31",
			levy: withCarryIn(levy, emptyCarryIn("2025-01-01")),
		})
		expect(
			financialIndependence(baseline, scenario, timeline, { method: "survival" }),
		).toMatchObject({
			ok: true,
			financialIndependence: {
				reachable: false,
				binding: "insufficientMoney",
				bestCase: { month: "2026-01-01", runsOut: { date: "2026-12-31", unmet: 500 } },
			},
		})
	})

	it("recomputes the Levy for each candidate", () => {
		const setup = {
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			balances: { cash: 0 },
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2027-06-30",
		} as const
		const withLevy = makeFixture({
			...setup,
			flows: [
				income("salary", 1000, { frequency: "monthly", label: "salary" }),
				expense("living", 100, { frequency: "monthly" }),
			],
			levy: withCarryIn(incomeLevy, emptyCarryIn("2025-01-01")),
		})
		const withoutLevy = makeFixture({
			...setup,
			flows: [
				income("salary", 1000, { frequency: "monthly" }),
				expense("living", 100, { frequency: "monthly" }),
			],
		})
		expect(
			financialIndependence(withLevy.baseline, withLevy.scenario, withLevy.timeline, {
				method: "survival",
			}),
		).toMatchObject({
			ok: true,
			financialIndependence: { reachable: true, month: "2027-03-01" },
		})
		expect(
			financialIndependence(withoutLevy.baseline, withoutLevy.scenario, withoutLevy.timeline, {
				method: "survival",
			}),
		).toMatchObject({
			ok: true,
			financialIndependence: { reachable: true, month: "2026-03-01" },
		})
	})
})

const capped: Levy = {
	id: "capped",
	period: { month: 1, day: 1 },
	settlement: { month: 12, day: 30 },
	measures: [
		{ id: "base", op: "const", value: 5_000 },
		{ id: "wage", op: "tally", label: "wage", basis: "gross" },
		{ id: "due", op: "const", value: 0 },
	],
	due: "due",
}

/** A salary that prepays 50% until a 5,000 wage base is reached, against 600 of monthly spending. */
function cappedSetup(salaryEnd?: string) {
	return makeFixture({
		accounts: [{ id: "cash", kind: "asset", rate: 0 }],
		balances: { cash: 1_100 },
		surplus: [{ account: "cash" }],
		withdraw: ["cash"],
		horizon: "2026-12-31",
		flows: [
			income("salary", 1_000, {
				frequency: "monthly",
				start: "2026-01-31",
				...(salaryEnd === undefined ? {} : { end: salaryEnd }),
				label: "wage",
				cappedPrepayment: { levy: "capped", bps: 5_000, upTo: "base" },
			}),
			expense("living", 600, { frequency: "monthly", start: "2026-01-01" }),
		],
		levy: withCarryIn(capped, emptyCarryIn("2025-01-01")),
	})
}

function projectionOf(salaryEnd?: string) {
	const { baseline, scenario, timeline } = cappedSetup(salaryEnd)
	const result = project(baseline, scenario, timeline)
	if (!result.ok) throw new Error(JSON.stringify(result.problems))
	return result.projection
}

const yieldLevy: Levy = withCarryIn(
	{
		id: "yield",
		period: { month: 1, day: 1 },
		settlement: { month: 12, day: 30 },
		measures: [
			{ id: "base", op: "const", value: 2_000 },
			{ id: "yield", op: "tally", label: "yield", basis: "gross" },
			{ id: "due", op: "const", value: 0 },
		],
		due: "due",
	},
	emptyCarryIn("2025-01-01"),
)

/** A passive capped income that keeps landing after earned income stops, so a candidate reads the cap. */
function yieldSetup(salaryEnd?: string) {
	return makeFixture({
		accounts: [{ id: "cash", kind: "asset", rate: 0 }],
		balances: { cash: 2_000 },
		surplus: [{ account: "cash" }],
		withdraw: ["cash"],
		horizon: "2026-12-31",
		flows: [
			income("salary", 1_000, {
				frequency: "monthly",
				start: "2026-01-31",
				...(salaryEnd === undefined ? {} : { end: salaryEnd }),
			}),
			income("yield", 1_000, {
				earned: false,
				frequency: "monthly",
				start: "2026-01-31",
				label: "yield",
				cappedPrepayment: { levy: "yield", bps: 5_000, upTo: "base" },
			}),
			expense("living", 1_500, { frequency: "monthly", start: "2026-01-01" }),
		],
		levy: yieldLevy,
	})
}

function yieldProjection(salaryEnd?: string) {
	const { baseline, scenario, timeline } = yieldSetup(salaryEnd)
	const result = project(baseline, scenario, timeline)
	if (!result.ok) throw new Error(JSON.stringify(result.problems))
	return result.projection
}

describe("a capped Prepayment in the FI walk", () => {
	it("reaches the FI month a full run with earned income stopped there reaches", () => {
		const { baseline, scenario, timeline } = cappedSetup()
		expect(
			financialIndependence(baseline, scenario, timeline, { method: "survival" }),
		).toMatchObject({ ok: true, financialIndependence: { reachable: true, month: "2026-10-01" } })
		// 5,000 of the 12,000 salary is prepaid over the first five months, so spending outlives it.
		const stopped = projectionOf("2026-09-30")
		expect(stopped.runsOut).toBeUndefined()
		// The full run and the candidate's prefix clone agree on the capped Prepayment.
		expect(periodFrom(stopped, "2026-01-01").prepaid).toBe(2_500)
		expect(projectionOf("2026-08-31").runsOut?.date).toBe("2026-12-01")
	})

	it("reads the cap against the tallies a candidate clone carries", () => {
		const { baseline, scenario, timeline } = yieldSetup()
		expect(
			financialIndependence(baseline, scenario, timeline, { method: "survival" }),
		).toMatchObject({ ok: true, financialIndependence: { reachable: true, month: "2026-07-01" } })
		const stopped = yieldProjection("2026-06-30")
		expect(stopped.runsOut).toBeUndefined()
		// The candidate at July starts with the yield base already reached, so nothing is prepaid again.
		expect(periodFrom(stopped, "2026-01-01").prepaid).toBe(1_000)
		expect(yieldProjection("2026-05-31").runsOut?.date).toBe("2026-11-01")
	})
})
