import { describe, expect, it } from "bun:test"
import { expense, income } from "../engine/test-flows"
import { makeFixture } from "../engine/test-helpers"
import type { Fixture } from "../fixtures/fixture"
import { financialIndependence } from "../index"
import type { ProbabilityThresholdOptions, ReturnModel, SurvivalOptions } from "../types"

const SEED = "0000000000000000"
const FULL = 4294967296
const HALF = 2147483648

const flat: ReturnModel = {
	id: "flat",
	accounts: ["cash"],
	buckets: [{ returnsBps: [0], weight: FULL }],
}

function probability(thresholdBps: number, paths: number): ProbabilityThresholdOptions {
	return { method: "probabilityThreshold", thresholdBps, paths, seed: SEED }
}

function run(fixture: Fixture, options: ProbabilityThresholdOptions, model: ReturnModel) {
	return financialIndependence(fixture.baseline, fixture.scenario, fixture.timeline, options, model)
}

const cash = { id: "cash", kind: "asset", rate: 0 } as const

/** The 300,000 June expense is replaced from M on, so stopping in January survives. */
const retirement: Fixture = makeFixture({
	accounts: [cash],
	balances: { cash: 1500 },
	flows: [expense("big", 300000, { start: "2026-06-01" })],
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	horizon: "2027-01-01",
})

describe("probabilityThreshold over ADR-0004's deterministic parts", () => {
	it("follows the survival answer when every path returns zero", () => {
		const retirementSpending = { amount: 100, growth: { bps: 0 } } as const
		const survival: SurvivalOptions = { method: "survival", retirementSpending }
		const options = { ...probability(10000, 2), retirementSpending }
		const baseline = financialIndependence(
			retirement.baseline,
			retirement.scenario,
			retirement.timeline,
			survival,
		)
		if (!baseline.ok || !baseline.financialIndependence.reachable) {
			throw new Error("expected the survival run to find a month")
		}
		expect(run(retirement, options, flat)).toMatchObject({
			ok: true,
			financialIndependence: {
				reachable: true,
				month: baseline.financialIndependence.month,
				fiSurvivalBps: 10000,
			},
		})
	})

	it("measures the minimum buffer over twelve months past the horizon", () => {
		// Required = 12 × 50 = 600, not the 150 three months inside the horizon; 350 < 600.
		const short = makeFixture({
			accounts: [cash],
			balances: { cash: 400 },
			flows: [expense("living", 50, { frequency: "monthly" })],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2026-03-01",
		})
		const options = { ...probability(1, 2), minBufferMonths: 12 }
		expect(run(short, options, flat)).toMatchObject({
			ok: true,
			financialIndependence: { binding: "thresholdNotReached", bestMonth: { fiSurvivalBps: 0 } },
		})
	})

	it("fails a path whose buffer holds at M but not at a later Occurrence", () => {
		const drains = makeFixture({
			accounts: [cash],
			balances: { cash: 2000 },
			flows: [expense("living", 100, { frequency: "monthly" })],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2027-01-01",
		})
		const failing = { ...probability(1, 2), minBufferMonths: 12 }
		expect(run(drains, failing, flat)).toMatchObject({
			ok: true,
			financialIndependence: { binding: "thresholdNotReached", bestMonth: { fiSurvivalBps: 0 } },
		})
		const passing = { ...probability(10000, 2), minBufferMonths: 6 }
		expect(run(drains, passing, flat)).toMatchObject({
			ok: true,
			financialIndependence: { reachable: true, fiSurvivalBps: 10000 },
		})
	})

	it("turns a buffer breach on one path into a partial share", () => {
		const twoWay: ReturnModel = {
			id: "two-way",
			accounts: ["cash"],
			buckets: [
				{ returnsBps: [0], weight: HALF },
				{ returnsBps: [-200], weight: HALF },
			],
		}
		// One row: seed 0 draws bucket 0 for path 0 and bucket 1 for path 1. Required is 600;
		// 0 bps ends at 600, while -200 bps ends at 586 without a Shortfall.
		const tight = makeFixture({
			accounts: [cash],
			balances: { cash: 700 },
			flows: [expense("living", 50, { frequency: "monthly" })],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2026-02-01",
		})
		const options = { ...probability(5000, 2), minBufferMonths: 12 }
		expect(run(tight, options, twoWay)).toMatchObject({
			ok: true,
			financialIndependence: { reachable: true, month: "2026-01-01", fiSurvivalBps: 5000 },
		})
	})

	it("fails a path whose Shortfall lands exactly on the horizon", () => {
		const horizonBill = makeFixture({
			accounts: [cash],
			balances: { cash: 100 },
			flows: [expense("bill", 1000, { start: "2026-06-01" })],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2026-06-01",
		})
		expect(run(horizonBill, probability(1, 1), flat)).toMatchObject({
			ok: true,
			financialIndependence: { binding: "thresholdNotReached", bestMonth: { fiSurvivalBps: 0 } },
		})
	})

	it("fails the whole call when a path overflows", () => {
		const overflowing = makeFixture({
			accounts: [{ id: "savings", kind: "asset", rate: 0 }],
			balances: { savings: Number.MAX_SAFE_INTEGER },
			flows: [{ ...income("interest", 1), earned: false }],
			surplus: [{ account: "savings" }],
			withdraw: ["savings"],
			horizon: "2026-02-01",
		})
		const model: ReturnModel = { ...flat, accounts: ["savings"] }
		expect(run(overflowing, probability(1, 1), model)).toEqual({
			ok: false,
			problems: [{ code: "VALUE_OVERFLOW", date: "2026-01-01", account: "savings" }],
		})
	})
})
