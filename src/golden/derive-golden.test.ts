import { describe, expect, it } from "bun:test"
import { project } from "../engine/project"
import { derivedExpense, derivedIncome, income } from "../engine/test-flows"
import { makeFixture } from "../engine/test-helpers"
import type { Fixture } from "../fixtures/fixture"
import type { DateString, Derive, Projection } from "../types"
import { oraclePlanned } from "./oracle-planned"

function portion(flow: string, percent: number): Derive {
	return {
		measures: [
			{ id: "source", op: "flow", flow },
			{ id: "result", op: "scale", of: "source", num: percent, den: 100, rounding: "halfUp" },
		],
		result: "result",
	}
}

const fixture: Fixture = makeFixture({
	accounts: [{ id: "cash", kind: "asset", rate: 0 }],
	balances: { cash: 1_000_000 },
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	start: "2026-01-01",
	horizon: "2027-06-30",
	resolution: "month",
	flows: [
		income("salary", 1_000_000, {
			frequency: "monthly",
			start: "2026-01-31",
			growth: { bps: 5000 },
		}),
		derivedExpense("rent", portion("salary", 30), { frequency: "monthly", start: "2026-01-31" }),
		derivedIncome("bonus", portion("rent", 100), { start: "2026-06-30" }),
	],
})

function projected(): Projection {
	const result = project(fixture.baseline, fixture.scenario, fixture.timeline)
	if (!result.ok) throw new Error(JSON.stringify(result.problems))
	return result.projection
}

/** Income minus expense per Landed date, summed through `through`. */
function cashThrough(through: DateString): number {
	const planned = oraclePlanned(fixture)
	let total = 1_000_000n
	for (const [date, day] of planned) {
		if (date > through) continue
		total += (day.get("salary") ?? 0n) + (day.get("bonus") ?? 0n)
		total -= day.get("rent") ?? 0n
	}
	return Number(total)
}

describe("Derived Flow amounts match the independent planner", () => {
	it("follows the salary raise in the oracle and in the Projection", () => {
		const planned = oraclePlanned(fixture)
		expect(planned.get("2026-01-31")?.get("rent")).toBe(300_000n)
		expect(planned.get("2027-01-31")?.get("rent")).toBe(450_000n)
		expect(planned.get("2026-06-30")?.get("bonus")).toBe(300_000n)
	})

	it("gives every reported row the oracle's cumulative cash", () => {
		const projection = projected()
		for (const row of projection.rows) {
			expect([row.date, row.balances[0]?.amount]).toEqual([row.date, cashThrough(row.date)])
		}
	})

	it("shows the hand-computed cash after the first Occurrence", () => {
		const projection = projected()
		// Month rows fall on the start's day of month, so the first is 1 February.
		const january = projection.rows.find((row) => row.date === "2026-02-01")
		// Opening 1,000,000 + salary 1,000,000 - rent 300,000.
		expect(january?.balances[0]?.amount).toBe(1_700_000)
	})
})
