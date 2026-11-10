import { describe, expect, it } from "bun:test"
import { buildProjection } from "../output/build"
import { periodEndDates } from "../output/periods"
import { rowDates } from "../output/row-dates"
import type { DateString, MinorUnits, Timeline } from "../types"
import type { Projection } from "../types/projection"
import type { Returns } from "./returns"
import { runEngine } from "./run"
import { emptyCarryIn, makeFixture, withCarryIn } from "./test-helpers"

/** 10% over each window; the row boundary sits on the Settlement period's last day. */
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

function observations(timeline: Timeline): readonly DateString[] {
	return [...rowDates(timeline), ...periodEndDates(timeline.start, timeline.horizon)]
}

function withSeries(withdrawal: boolean): Projection {
	const fixture = makeFixture({
		accounts: [{ id: "deposit", kind: "asset", rate: 0, returnLabel: "interest" }],
		balances: { deposit: 100_000 },
		flows: withdrawal
			? [
					{
						id: "fee",
						kind: "expense",
						amount: 10_000,
						frequency: "once",
						start: "2027-06-01",
						growth: { bps: 0 },
					},
				]
			: [],
		surplus: [{ account: "deposit" }],
		withdraw: ["deposit"],
		start: "2026-01-01",
		horizon: "2027-12-31",
		levy: withCarryIn(
			{
				id: "returns",
				period: { month: 1, day: 1 },
				settlement: { month: 3, day: 31 },
				measures: [
					{ id: "interest", op: "tally", label: "interest", basis: "returns" },
					{ id: "zero", op: "const", value: 0 },
				],
				due: "zero",
			},
			emptyCarryIn("2025-01-01"),
		),
	})
	const run = runEngine(
		fixture.baseline,
		fixture.scenario,
		fixture.timeline,
		observations(fixture.timeline),
		returns,
	)
	if (!run.ok) throw new Error(JSON.stringify(run.problem))
	const built = buildProjection(run.run, fixture.baseline, fixture.scenario, fixture.timeline)
	if ("problem" in built) throw new Error(JSON.stringify(built.problem))
	return built.projection
}

function returned(projection: Projection, from: string): MinorUnits {
	const period = projection.levies?.[0]?.periods.find((item) => item.from === from)
	if (period === undefined) throw new Error(`Missing period ${from}`)
	const found = period.measures.find((item) => item.id === "interest")
	if (found === undefined) throw new Error("Missing interest measure")
	return found.value
}

function finalValue(projection: Projection): MinorUnits {
	const row = projection.rows.at(-1)
	const found = row?.balances.find((item) => item.account === "deposit")
	if (found === undefined) throw new Error("Missing deposit")
	return found.amount
}

describe("the returns tally over a Return series", () => {
	it("reads the series' growth as 10% in each Settlement period", () => {
		const projection = withSeries(false)
		expect(returned(projection, "2026-01-01")).toBe(10_000)
		expect(returned(projection, "2027-01-01")).toBe(11_000)
		expect(finalValue(projection)).toBe(121_000)
	})

	it("splits a withdrawal's growth at the period end it has already closed", () => {
		// 110,000 × (3,650,000 + 1,000 × 152) / 3,650,000 = 114,580.82 → 114,581 at 2027-06-01
		// 104,581 × (3,650,000 + 1,000 × 213) / 3,650,000 = 110,683.94 → 110,684 at 2027-12-31
		const projection = withSeries(true)
		expect(returned(projection, "2026-01-01")).toBe(10_000)
		expect(returned(projection, "2027-01-01")).toBe(10_684)
		expect(finalValue(projection)).toBe(110_684)
	})
})
