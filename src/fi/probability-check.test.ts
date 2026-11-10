import { describe, expect, it } from "bun:test"
import { makeFixture } from "../engine/test-helpers"
import { financialIndependence } from "../index"
import { expected } from "../testing"
import type { FinancialIndependenceOptions, ReturnModel } from "../types"

const FULL = 4294967296
const SEED = "0000000000000000"

const cash = { id: "cash", kind: "asset", rate: 0 } as const

const fixture = makeFixture({
	accounts: [cash],
	balances: { cash: 100 },
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	horizon: "2026-01-01",
})

const flat: ReturnModel = {
	id: "flat",
	accounts: ["cash"],
	buckets: [{ returnsBps: [0], weight: FULL }],
}

const base = {
	method: "probabilityThreshold",
	thresholdBps: 5000,
	paths: 10,
	seed: SEED,
} as const

function run(options: unknown, market: unknown) {
	return financialIndependence(
		fixture.baseline,
		fixture.scenario,
		fixture.timeline,
		options as FinancialIndependenceOptions,
		market as ReturnModel,
	)
}

function modelWith(changes: Partial<ReturnModel>): ReturnModel {
	return { ...flat, ...changes }
}

describe("probabilityThreshold options validation", () => {
	it("requires the threshold, path count and seed", () => {
		expect(run({ method: "probabilityThreshold" }, flat)).toEqual({
			ok: false,
			problems: [
				{ code: "MISSING_KEY", path: ["options", "thresholdBps"] },
				{ code: "MISSING_KEY", path: ["options", "paths"] },
				{ code: "MISSING_KEY", path: ["options", "seed"] },
			],
		})
	})

	it("keeps an unknown method as INVALID_FI_METHOD", () => {
		expect(run({ ...base, method: "probability" }, flat)).toEqual({
			ok: false,
			problems: expected("INVALID_FI_METHOD", ["options", "method"]),
		})
	})

	it("rejects a threshold outside 1..10000 and a fractional threshold", () => {
		expect(run({ ...base, thresholdBps: 0 }, flat)).toEqual({
			ok: false,
			problems: expected("RATE_OUT_OF_RANGE", ["options", "thresholdBps"]),
		})
		expect(run({ ...base, thresholdBps: 10001 }, flat)).toEqual({
			ok: false,
			problems: expected("RATE_OUT_OF_RANGE", ["options", "thresholdBps"]),
		})
		expect(run({ ...base, thresholdBps: 1.5 }, flat)).toEqual({
			ok: false,
			problems: expected("NOT_SAFE_INTEGER", ["options", "thresholdBps"]),
		})
	})

	it("rejects a path count outside 1..200 and a fractional path count", () => {
		expect(run({ ...base, paths: 0 }, flat)).toEqual({
			ok: false,
			problems: expected("INVALID_PATH_COUNT", ["options", "paths"]),
		})
		expect(run({ ...base, paths: 201 }, flat)).toEqual({
			ok: false,
			problems: expected("INVALID_PATH_COUNT", ["options", "paths"]),
		})
		expect(run({ ...base, paths: 2.5 }, flat)).toEqual({
			ok: false,
			problems: expected("NOT_SAFE_INTEGER", ["options", "paths"]),
		})
	})

	it("rejects a seed that is not 16 lower-case hex digits", () => {
		for (const seed of ["", "000000000000000", "00000000000000000", "000000000000000G", 1]) {
			expect(run({ ...base, seed }, flat)).toEqual({
				ok: false,
				problems: expected("INVALID_SEED", ["options", "seed"]),
			})
		}
	})

	it("requires the model for a probability run and ignores it for survival", () => {
		expect(run(base, undefined)).toEqual({
			ok: false,
			problems: expected("MISSING_KEY", ["model"]),
		})
		expect(run({ method: "survival" }, undefined)).toMatchObject({ ok: true })
		expect(run({ method: "survival" }, modelWith({ accounts: ["ghost"] }))).toMatchObject({
			ok: true,
		})
	})
})

describe("Return model validation", () => {
	it("requires an id, accounts and buckets", () => {
		expect(run(base, {})).toEqual({
			ok: false,
			problems: [
				{ code: "MISSING_KEY", path: ["model", "id"] },
				{ code: "MISSING_KEY", path: ["model", "accounts"] },
				{ code: "MISSING_KEY", path: ["model", "buckets"] },
			],
		})
	})

	it("rejects an account the Scenario does not declare and a duplicate account", () => {
		expect(run(base, modelWith({ accounts: ["ghost"] }))).toMatchObject({
			ok: false,
			problems: [{ code: "UNKNOWN_ACCOUNT", path: ["model", "accounts", 0] }],
		})
		expect(
			run(
				base,
				modelWith({
					accounts: ["cash", "cash"],
					buckets: [{ returnsBps: [0, 0], weight: FULL }],
				}),
			),
		).toMatchObject({
			ok: false,
			problems: [{ code: "DUPLICATE_ID", path: ["model", "accounts", 1] }],
		})
	})

	it("rejects a bucket whose return count does not match the accounts", () => {
		expect(run(base, modelWith({ buckets: [{ returnsBps: [0, 0], weight: FULL }] }))).toEqual({
			ok: false,
			problems: expected("WRONG_TYPE", ["model", "buckets", 0, "returnsBps"]),
		})
	})

	it("rejects a negative weight and a weight total other than 2^32", () => {
		expect(run(base, modelWith({ buckets: [{ returnsBps: [0], weight: -1 }] }))).toEqual({
			ok: false,
			problems: expected("INVALID_WEIGHT", ["model", "buckets", 0, "weight"]),
		})
		expect(run(base, modelWith({ buckets: [{ returnsBps: [0], weight: 1 }] }))).toEqual({
			ok: false,
			problems: expected("RETURN_WEIGHT_TOTAL", ["model", "buckets"]),
		})
	})

	it("rejects a span return outside -9999..10000", () => {
		expect(run(base, modelWith({ buckets: [{ returnsBps: [10001], weight: FULL }] }))).toEqual({
			ok: false,
			problems: expected("RATE_OUT_OF_RANGE", ["model", "buckets", 0, "returnsBps", 0]),
		})
	})

	it("rejects more than 64 accounts and more than 512 buckets", () => {
		const accounts = Array.from({ length: 65 }, (_unused, index) => `ghost-${index}`)
		const tooManyAccounts = run(base, modelWith({ accounts }))
		if (tooManyAccounts.ok) throw new Error("expected a failure")
		expect(tooManyAccounts.problems).toContainEqual({
			code: "TOO_MANY_ENTRIES",
			path: ["model", "accounts"],
		})
		const buckets = Array.from({ length: 513 }, () => ({ returnsBps: [0], weight: 1 }))
		const tooManyBuckets = run(base, modelWith({ buckets }))
		if (tooManyBuckets.ok) throw new Error("expected a failure")
		expect(tooManyBuckets.problems).toContainEqual({
			code: "TOO_MANY_ENTRIES",
			path: ["model", "buckets"],
		})
	})

	it("rejects a Timeline longer than 1,200 month rows", () => {
		const long = makeFixture({
			accounts: [cash],
			balances: { cash: 100 },
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2130-01-01",
		})
		expect(financialIndependence(long.baseline, long.scenario, long.timeline, base, flat)).toEqual({
			ok: false,
			problems: expected("TOO_MANY_ENTRIES", ["timeline", "horizon"]),
		})
	})
})
