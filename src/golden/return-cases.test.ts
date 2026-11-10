import { describe, expect, it } from "bun:test"
import { project } from "../engine/project"
import { resolveReturns } from "../engine/return-rows"
import type { ReturnSeries, Returns } from "../engine/returns"
import { runEngine } from "../engine/run"
import { createStates } from "../engine/state"
import { valuation } from "../engine/value"
import type { Fixture } from "../fixtures/fixture"
import { buildProjection } from "../output/build"
import { periodEndDates } from "../output/periods"
import { rowDates } from "../output/row-dates"
import type { DateString, Timeline } from "../types"
import type { Projection } from "../types/projection"
import { oracleResolveRows, oracleSpanGrow } from "./oracle-returns"
import { handRows, handRowsReturns } from "./return-cases"
import { zeroRateFixture, zeroRateReturns } from "./zero-rate-cases"

const HAND = handRowsReturns.series[0] as ReturnSeries
const ROWS = oracleResolveRows(HAND.rows, handRows.timeline.horizon)

function engineValue(fixture: Fixture, input: Returns): bigint {
	const states = createStates(
		fixture.baseline,
		fixture.scenario,
		fixture.timeline.start,
		resolveReturns(input, fixture.timeline),
	)
	return valuation(states.get("cash")!, fixture.timeline.horizon)
}

function observations(timeline: Timeline): readonly DateString[] {
	return [...rowDates(timeline), ...periodEndDates(timeline.start, timeline.horizon)]
}

function seriesProjection(fixture: Fixture, returns: Returns): Projection {
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

describe("the oracle's row walk", () => {
	it("matches the hand-computed values", () => {
		// 100,000 × (10,000×180 + 1,000×90) / (10,000×180) = 105,000
		expect(oracleSpanGrow(100000n, "2023-01-01", "2023-04-01", ROWS)).toBe(105000n)
		// 100,000 × 11,000 / 10,000 = 110,000
		expect(oracleSpanGrow(100000n, "2023-01-01", "2023-06-30", ROWS)).toBe(110000n)
		// 110,000 × 10,800 / 10,000 = 118,800
		expect(oracleSpanGrow(100000n, "2023-01-01", "2024-01-01", ROWS)).toBe(118800n)
	})

	it("reproduces the engine at every month start", () => {
		expect(engineValue(handRows, handRowsReturns)).toBe(118800n)
		const states = createStates(
			handRows.baseline,
			handRows.scenario,
			handRows.timeline.start,
			resolveReturns(handRowsReturns, handRows.timeline),
		)
		for (let month = 0; month <= 12; month++) {
			const date = `2023-${String(month === 0 ? 1 : month).padStart(2, "0")}-01`
			expect(valuation(states.get("cash")!, date)).toBe(
				oracleSpanGrow(100000n, "2023-01-01", date, ROWS),
			)
		}
	})

	it("records the r² term of a row split at its midpoint", () => {
		const atMidpoint = oracleSpanGrow(100000n, "2023-01-01", "2023-04-01", ROWS)
		const split = oracleSpanGrow(atMidpoint, "2023-04-01", "2023-06-30", ROWS)
		// r²·h₁h₂/D² = 0.01 × 0.25 = 0.0025, so 100,000 × 0.0025 = 250 above 110,000.
		expect(split).toBe(110250n)
		expect(split - oracleSpanGrow(100000n, "2023-01-01", "2023-06-30", ROWS)).toBe(250n)
	})
})

describe("a Return series over an all-zero-rate fixture", () => {
	it("reproduces project() on the same fixture", () => {
		const expected = project(
			zeroRateFixture.baseline,
			zeroRateFixture.scenario,
			zeroRateFixture.timeline,
		)
		if (!expected.ok) throw new Error(JSON.stringify(expected.problems))
		expect(seriesProjection(zeroRateFixture, zeroRateReturns)).toEqual(expected.projection)
	})

	it("keeps the Shortfall the fixture was built for", () => {
		const built = seriesProjection(zeroRateFixture, zeroRateReturns)
		expect(built.runsOut?.date).toBe("2026-12-31")
		expect(built.runsOut?.unmet).toBeGreaterThan(0)
	})
})
