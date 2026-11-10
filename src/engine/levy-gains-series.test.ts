import { describe, expect, it } from "bun:test"
import type { Fixture } from "../fixtures/fixture"
import { buildProjection } from "../output/build"
import { periodEndDates } from "../output/periods"
import { rowDates } from "../output/row-dates"
import type { Account, DateString, Levy, MinorUnits, Projection, Timeline } from "../types"
import type { Returns } from "./returns"
import { runEngine } from "./run"
import { emptyCarryIn, makeFixture, withCarryIn } from "./test-helpers"

function observations(timeline: Timeline): readonly DateString[] {
	return [...rowDates(timeline), ...periodEndDates(timeline.start, timeline.horizon)]
}

function projectionOf(fixture: Fixture, returns: Returns): Projection {
	const { baseline, scenario, timeline } = fixture
	const run = runEngine(baseline, scenario, timeline, observations(timeline), returns)
	if (!run.ok) throw new Error(JSON.stringify(run.problem))
	const built = buildProjection(run.run, baseline, scenario, timeline)
	if ("problem" in built) throw new Error(JSON.stringify(built.problem))
	return built.projection
}

function measureOf(projection: Projection, from: string, id: string): MinorUnits {
	const period = projection.levies?.[0]?.periods.find((item) => item.from === from)
	if (period === undefined) throw new Error(`Missing period ${from}`)
	const found = period.measures.find((item) => item.id === id)
	if (found === undefined) throw new Error(`Missing ${id}`)
	return found.value
}

const brokerage: Account = { id: "brokerage", kind: "asset", rate: 0, gainLabel: "gain" }

const gainsLevy: Levy = withCarryIn(
	{
		id: "gains",
		period: { month: 1, day: 1 },
		settlement: { month: 3, day: 31 },
		measures: [
			{ id: "gain", op: "tally", label: "gain", basis: "gains" },
			{ id: "zero", op: "const", value: 0 },
		],
		due: "zero",
	},
	emptyCarryIn("2025-01-01"),
)

/** 100,000 → 107,068 by 2027-06-01: 1,000 bps over a 730-day row, 516 days held. */
const returns: Returns = {
	returnsVersion: 1,
	series: [
		{
			account: "brokerage",
			rows: [
				{ from: "2026-01-01", returnBps: 1000 },
				{ from: "2028-01-01", returnBps: 0 },
			],
		},
	],
}

function fixtureFor(): Fixture {
	return makeFixture({
		accounts: [brokerage],
		balances: { brokerage: 100_000 },
		basis: { brokerage: 100_000 },
		flows: [
			{
				id: "sell",
				kind: "expense",
				amount: 53_534,
				frequency: "once",
				start: "2027-06-01",
				growth: { bps: 0 },
			},
		],
		surplus: [{ account: "brokerage" }],
		withdraw: ["brokerage"],
		start: "2026-01-01",
		horizon: "2027-12-31",
		levy: gainsLevy,
	})
}

describe("the gains tally over a Return series", () => {
	it("realises the grown value's share of basis when the Account has no returnLabel", () => {
		// 53,534 of the 107,068 value is half of it, so exactly 50,000 basis is used.
		const projection = projectionOf(fixtureFor(), returns)
		expect(measureOf(projection, "2027-01-01", "gain")).toBe(3_534)
	})
})
