import { describe, expect, it } from "bun:test"
import { expense, income } from "../engine/test-flows"
import { makeFixture } from "../engine/test-helpers"
import type { Fixture } from "../fixtures/fixture"
import { financialIndependence } from "../index"
import type { ProbabilityThresholdOptions, ReturnModel } from "../types"

const SEED = "0000000000000000"
const FULL = 4294967296
const HALF = 2147483648

const flat: ReturnModel = {
	id: "flat",
	accounts: ["cash"],
	buckets: [{ returnsBps: [0], weight: FULL }],
}

const crash: ReturnModel = {
	id: "crash",
	accounts: ["cash"],
	buckets: [{ returnsBps: [-9999], weight: FULL }],
}

const twoWay: ReturnModel = {
	id: "two-way",
	accounts: ["cash"],
	buckets: [
		{ returnsBps: [0], weight: HALF },
		{ returnsBps: [-9999], weight: HALF },
	],
}

function options(thresholdBps: number, paths: number): ProbabilityThresholdOptions {
	return { method: "probabilityThreshold", thresholdBps, paths, seed: SEED }
}

function fi(fixture: Fixture, thresholdBps: number, paths: number, model: ReturnModel) {
	return financialIndependence(
		fixture.baseline,
		fixture.scenario,
		fixture.timeline,
		options(thresholdBps, paths),
		model,
	)
}

/** Stopping earned income at January survives: 100,000 of income and 50 of spending a month. */
const steady = makeFixture({
	accounts: [{ id: "cash", kind: "asset", rate: 0 }],
	balances: { cash: 0 },
	flows: [
		income("pay", 100, { frequency: "monthly" }),
		expense("living", 50, { frequency: "monthly" }),
	],
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	horizon: "2026-06-01",
})

/** One 60,000 expense on 2026-01-15 cannot be funded when the first month falls 99.99%. */
const oneBill = makeFixture({
	accounts: [{ id: "cash", kind: "asset", rate: 0 }],
	balances: { cash: 100000 },
	flows: [expense("bill", 60000, { start: "2026-01-15" })],
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	horizon: "2026-02-01",
})

describe("financialIndependence probabilityThreshold", () => {
	it("reports the survival month and a full share when every path returns zero", () => {
		expect(fi(steady, 10000, 5, flat)).toEqual({
			ok: true,
			financialIndependence: {
				reachable: true,
				definition: {
					method: "probabilityThreshold",
					thresholdBps: 10000,
					paths: 5,
					seed: SEED,
					modelId: "flat",
					definitionVersion: 1,
				},
				month: "2026-04-01",
				fiSurvivalBps: 10000,
			},
		})
	})

	it("reports the highest share and its first month when no month reaches the threshold", () => {
		expect(fi(oneBill, 1, 2, crash)).toEqual({
			ok: true,
			financialIndependence: {
				reachable: false,
				definition: {
					method: "probabilityThreshold",
					thresholdBps: 1,
					paths: 2,
					seed: SEED,
					modelId: "crash",
					definitionVersion: 1,
				},
				binding: "thresholdNotReached",
				bestMonth: { month: "2026-01-01", fiSurvivalBps: 0 },
			},
		})
	})

	it("reaches the month when exactly half the paths survive a 5,000 bps threshold", () => {
		// Seed 0, path 0's first draw is 0x238275bc (bucket 0) and path 1's is 0xb18a02f4 (bucket 1).
		const result = fi(oneBill, 5000, 2, twoWay)
		expect(result).toMatchObject({
			ok: true,
			financialIndependence: { reachable: true, month: "2026-01-01", fiSurvivalBps: 5000 },
		})
	})

	it("reports the first month when a later month has the same highest share", () => {
		const result = fi(oneBill, 5001, 2, twoWay)
		expect(result).toMatchObject({
			ok: true,
			financialIndependence: {
				reachable: false,
				binding: "thresholdNotReached",
				bestMonth: { month: "2026-01-01", fiSurvivalBps: 5000 },
			},
		})
	})

	it("never draws a zero-weight bucket", () => {
		const onlyFlat: ReturnModel = {
			id: "only-flat",
			accounts: ["cash"],
			buckets: [
				{ returnsBps: [0], weight: FULL },
				{ returnsBps: [-9999], weight: 0 },
			],
		}
		expect(fi(oneBill, 10000, 7, onlyFlat)).toMatchObject({
			ok: true,
			financialIndependence: { reachable: true, month: "2026-01-01", fiSurvivalBps: 10000 },
		})
	})

	it("fails every path when the minimum buffer cannot be met", () => {
		const buffered = { ...options(1, 3), minBufferMonths: 6 }
		const result = financialIndependence(
			steady.baseline,
			steady.scenario,
			steady.timeline,
			buffered,
			flat,
		)
		expect(result).toMatchObject({
			ok: true,
			financialIndependence: {
				reachable: false,
				binding: "thresholdNotReached",
				bestMonth: { month: "2026-01-01", fiSurvivalBps: 0 },
			},
		})
	})

	it("gives the same answer at day and month resolution", () => {
		const monthly = { ...oneBill, timeline: { ...oneBill.timeline, resolution: "month" as const } }
		expect(fi(monthly, 5000, 2, twoWay)).toEqual(fi(oneBill, 5000, 2, twoWay))
	})

	it("returns noCandidateMonth when the candidate grid is empty", () => {
		const shortLived: Fixture = {
			...steady,
			timeline: { ...steady.timeline, start: "2026-01-15", horizon: "2026-01-20" },
		}
		expect(fi(shortLived, 5000, 2, flat)).toMatchObject({
			ok: true,
			financialIndependence: { reachable: false, binding: "noCandidateMonth" },
		})
	})
})
