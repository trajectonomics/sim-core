import { describe, expect, it } from "bun:test"
import { project } from "../engine/project"
import type { Returns } from "../engine/returns"
import { runEngine } from "../engine/run"
import { expense } from "../engine/test-flows"
import { emptyCarryIn, makeFixture, withCarryIn } from "../engine/test-helpers"
import { buildProjection } from "../output/build"
import { periodEndDates } from "../output/periods"
import { rowDates } from "../output/row-dates"
import type { DateString, Levy, MinorUnits, Projection, Timeline } from "../types"
import { oracleCountedDays } from "./oracle-date"
import { oracleReturnPiece } from "./oracle-levy"
import { oracleGrow } from "./oracle-money"
import { oracleResolveRows, oracleSpanGrow } from "./oracle-returns"

const returnsLevy: Levy = {
	id: "returns",
	period: { month: 1, day: 1 },
	settlement: { month: 3, day: 31 },
	measures: [
		{ id: "interest", op: "tally", label: "interest", basis: "returns" },
		{ id: "zero", op: "const", value: 0 },
	],
	due: "zero",
}

function returned(projection: Projection, from: string): MinorUnits {
	const period = projection.levy?.periods.find((item) => item.from === from)
	if (period === undefined) throw new Error(`Missing period ${from}`)
	const found = period.measures.find((item) => item.id === "interest")
	if (found === undefined) throw new Error("Missing interest")
	return found.value
}

function observations(timeline: Timeline): readonly DateString[] {
	return [...rowDates(timeline), ...periodEndDates(timeline.start, timeline.horizon)]
}

describe("golden returns tally cases", () => {
	it("splits a committed account's growth at the period boundary it crosses", () => {
		// A deposit of 100,000 at 1,000 bps, an expense of 10,000 on 2029-06-01.
		const fixture = makeFixture({
			accounts: [{ id: "deposit", kind: "asset", rate: 1000, returnLabel: "interest" }],
			balances: { deposit: 100_000 },
			flows: [expense("fee", 10_000, { start: "2029-06-01" })],
			surplus: [{ account: "deposit" }],
			withdraw: ["deposit"],
			start: "2028-01-01",
			horizon: "2029-12-31",
			levy: withCarryIn(returnsLevy, emptyCarryIn("2027-01-01")),
		})
		const first = oracleReturnPiece(100_000n, 1000, "2028-01-01", "2028-12-31", 0n)
		const atExpense = oracleGrow(100_000n, 1000, oracleCountedDays("2028-01-01", "2029-06-01"))
		const afterExpense = atExpense - 10_000n
		const final = oracleGrow(afterExpense, 1000, oracleCountedDays("2029-06-01", "2029-12-31"))
		const second =
			oracleReturnPiece(100_000n, 1000, "2028-01-01", "2029-06-01", first) +
			oracleReturnPiece(afterExpense, 1000, "2029-06-01", "2029-12-31", 0n)
		const projection = project(fixture.baseline, fixture.scenario, fixture.timeline)
		if (!projection.ok) throw new Error(JSON.stringify(projection.problems))
		expect(returned(projection.projection, "2028-01-01")).toBe(Number(first))
		expect(returned(projection.projection, "2029-01-01")).toBe(Number(second))
		const last = projection.projection.rows.at(-1)?.balances[0]?.amount
		expect(last).toBe(Number(final))
		expect(Number(first + second)).toBe(Number(final) - 100_000 + 10_000)
	})

	it("splits a Return series at the row and period boundaries", () => {
		const series = oracleResolveRows(
			[
				{ from: "2026-01-01", returnBps: 1000 },
				{ from: "2026-12-31", returnBps: 1000 },
			],
			"2027-12-31",
		)
		const first = oracleSpanGrow(100_000n, "2026-01-01", "2026-12-31", series)
		const final = oracleSpanGrow(100_000n, "2026-01-01", "2027-12-31", series)
		const returns: Returns = {
			returnsVersion: 1,
			series: [
				{
					account: "deposit",
					rows: [
						{ from: "2026-01-01", returnBps: 1000 },
						{ from: "2026-12-31", returnBps: 1000 },
					],
				},
			],
		}
		const { baseline, scenario, timeline } = makeFixture({
			accounts: [{ id: "deposit", kind: "asset", rate: 0, returnLabel: "interest" }],
			balances: { deposit: 100_000 },
			surplus: [{ account: "deposit" }],
			start: "2026-01-01",
			horizon: "2027-12-31",
			levy: withCarryIn(returnsLevy, emptyCarryIn("2025-01-01")),
		})
		const run = runEngine(baseline, scenario, timeline, observations(timeline), returns)
		if (!run.ok) throw new Error(JSON.stringify(run.problem))
		const built = buildProjection(run.run, baseline, scenario, timeline)
		if ("problem" in built) throw new Error(JSON.stringify(built.problem))
		expect(returned(built.projection, "2026-01-01")).toBe(10_000)
		expect(returned(built.projection, "2027-01-01")).toBe(Number(final - first))
	})

	it("adds a mid-period Carry-in to the growth that follows it", () => {
		const fixture = makeFixture({
			accounts: [{ id: "deposit", kind: "asset", rate: 1000, returnLabel: "interest" }],
			balances: { deposit: 100_000 },
			surplus: [{ account: "deposit" }],
			start: "2028-07-01",
			horizon: "2028-12-31",
			levy: withCarryIn(returnsLevy, {
				periodStart: "2028-01-01",
				tallies: [{ label: "interest", basis: "returns", amount: 5000 }],
				prepaid: 0,
			}),
		})
		const projection = project(fixture.baseline, fixture.scenario, fixture.timeline)
		if (!projection.ok) throw new Error(JSON.stringify(projection.problems))
		const growth = oracleReturnPiece(100_000n, 1000, "2028-07-01", "2028-12-31", 0n)
		expect(returned(projection.projection, "2028-01-01")).toBe(5000 + Number(growth))
	})

	it("reports the growth through a Shortfall's date", () => {
		const fixture = makeFixture({
			accounts: [{ id: "deposit", kind: "asset", rate: 1000, returnLabel: "interest" }],
			balances: { deposit: 100_000 },
			flows: [expense("huge", 200_000, { start: "2028-06-01" })],
			surplus: [{ account: "deposit" }],
			withdraw: ["deposit"],
			start: "2028-01-01",
			horizon: "2030-12-31",
			levy: withCarryIn(returnsLevy, emptyCarryIn("2027-01-01")),
		})
		const projection = project(fixture.baseline, fixture.scenario, fixture.timeline)
		if (!projection.ok) throw new Error(JSON.stringify(projection.problems))
		expect(projection.projection.runsOut?.date).toBe("2028-06-01")
		expect(returned(projection.projection, "2028-01-01")).toBe(
			Number(oracleReturnPiece(100_000n, 1000, "2028-01-01", "2028-06-01", 0n)),
		)
	})
})
