import { describe, expect, it } from "bun:test"
import { makeFixture } from "../engine/test-helpers"
import { financialIndependence } from "../index"
import { expected } from "../testing"
import type { SurvivalOptions } from "../types"

const fixture = makeFixture({
	accounts: [{ id: "cash", kind: "asset", rate: 0 }],
	balances: { cash: 100 },
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	horizon: "2026-01-01",
})

function problemsFor(options: unknown) {
	return financialIndependence(
		fixture.baseline,
		fixture.scenario,
		fixture.timeline,
		options as SurvivalOptions,
	)
}

describe("financialIndependence options validation", () => {
	it("requires the method", () => {
		expect(problemsFor({})).toEqual({
			ok: false,
			problems: expected("MISSING_KEY", ["options", "method"]),
		})
	})

	it("rejects an unknown method with INVALID_FI_METHOD", () => {
		expect(problemsFor({ method: "probability" })).toEqual({
			ok: false,
			problems: expected("INVALID_FI_METHOD", ["options", "method"]),
		})
	})

	it("rejects a negative minimum buffer", () => {
		expect(problemsFor({ method: "survival", minBufferMonths: -1 })).toEqual({
			ok: false,
			problems: expected("NEGATIVE_AMOUNT", ["options", "minBufferMonths"]),
		})
	})

	it("rejects a fractional minimum buffer", () => {
		expect(problemsFor({ method: "survival", minBufferMonths: 1.5 })).toEqual({
			ok: false,
			problems: expected("NOT_SAFE_INTEGER", ["options", "minBufferMonths"]),
		})
	})

	it("rejects a negative retirement amount", () => {
		expect(
			problemsFor({
				method: "survival",
				retirementSpending: { amount: -1, growth: { bps: 0 } },
			}),
		).toEqual({
			ok: false,
			problems: expected("NEGATIVE_AMOUNT", ["options", "retirementSpending", "amount"]),
		})
	})

	it("rejects invalid retirement growth", () => {
		expect(
			problemsFor({ method: "survival", retirementSpending: { amount: 100, growth: 5 } }),
		).toEqual({
			ok: false,
			problems: expected("INVALID_GROWTH", ["options", "retirementSpending", "growth"]),
		})
	})

	it("rejects unknown top-level and nested keys", () => {
		expect(problemsFor({ method: "survival", extra: true })).toEqual({
			ok: false,
			problems: expected("UNKNOWN_KEY", ["options", "extra"]),
		})
		expect(
			problemsFor({
				method: "survival",
				retirementSpending: { amount: 100, growth: { bps: 0 }, extra: true },
			}),
		).toEqual({
			ok: false,
			problems: expected("UNKNOWN_KEY", ["options", "retirementSpending", "extra"]),
		})
	})

	it("rejects a non-object options value without throwing", () => {
		expect(problemsFor(null)).toEqual({
			ok: false,
			problems: expected("NOT_AN_OBJECT", ["options"]),
		})
	})

	it("accepts the survival method", () => {
		expect(problemsFor({ method: "survival" })).toMatchObject({ ok: true })
	})
})
