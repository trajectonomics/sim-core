import { describe, expect, it } from "bun:test"
import { expense, income } from "../engine/test-flows"
import { makeFixture } from "../engine/test-helpers"
import { financialIndependence } from "../index"
import type { SurvivalOptions } from "../types"

function fi(
	setup: Parameters<typeof makeFixture>[0],
	options: SurvivalOptions = { method: "survival" },
) {
	const { baseline, scenario, timeline } = makeFixture(setup)
	return financialIndependence(baseline, scenario, timeline, options)
}

const cash = { id: "cash", kind: "asset", rate: 0 } as const

describe("overflow as data", () => {
	it("returns a problem when a candidate overflows mid-scan", () => {
		expect(
			fi({
				accounts: [{ id: "savings", kind: "asset", rate: 0 }],
				balances: { savings: Number.MAX_SAFE_INTEGER },
				flows: [{ ...income("interest", 1), earned: false }],
				surplus: [{ account: "savings" }],
				withdraw: ["savings"],
				horizon: "2026-02-01",
			}),
		).toEqual({
			ok: false,
			problems: [{ code: "VALUE_OVERFLOW", date: "2026-01-01", account: "savings" }],
		})
	})

	it("lets an earlier candidate stop the flow that would overflow", () => {
		expect(
			fi({
				accounts: [{ id: "savings", kind: "asset", rate: 0 }],
				balances: { savings: Number.MAX_SAFE_INTEGER },
				flows: [income("bonus", 1, { start: "2026-02-01" })],
				surplus: [{ account: "savings" }],
				withdraw: ["savings"],
				horizon: "2026-02-01",
			}),
		).toMatchObject({
			ok: true,
			financialIndependence: { reachable: true, month: "2026-01-01" },
		})
	})

	it("returns a problem instead of misclassifying an unsafe locked asset", () => {
		expect(
			fi({
				accounts: [{ id: "vault", kind: "asset", rate: 5000, lockedUntil: "2099-01-01" }],
				balances: { vault: Number.MAX_SAFE_INTEGER },
				flows: [expense("bill", 100, { start: "2027-01-01" })],
				surplus: [{ account: "vault" }],
				withdraw: [],
				horizon: "2027-01-01",
			}),
		).toEqual({
			ok: false,
			problems: [{ code: "VALUE_OVERFLOW", date: "2027-01-01", account: "vault" }],
		})
	})

	it("keeps scanning for a later candidate after an overflowing one", () => {
		expect(
			fi({
				accounts: [
					{ id: "cash", kind: "asset", rate: 0 },
					{ id: "vault", kind: "asset", rate: 5000, lockedUntil: "2099-01-01" },
				],
				balances: { cash: 0, vault: Number.MAX_SAFE_INTEGER },
				flows: [
					income("jan-pay", 100, { start: "2026-01-01" }),
					expense("bill", 100, { start: "2027-01-01" }),
				],
				surplus: [{ account: "cash" }],
				withdraw: ["cash"],
				horizon: "2027-01-01",
			}),
		).toMatchObject({
			ok: true,
			financialIndependence: { reachable: true, month: "2026-02-01" },
		})
	})

	it("returns a problem for an unsafe reference value", () => {
		expect(
			fi(
				{
					accounts: [cash],
					balances: { cash: Number.MAX_SAFE_INTEGER },
					surplus: [{ account: "cash" }],
					withdraw: ["cash"],
					horizon: "2026-01-01",
				},
				{
					method: "survival",
					retirementSpending: { amount: Number.MAX_SAFE_INTEGER, growth: { bps: 0 } },
				},
			),
		).toEqual({ ok: false, problems: [{ code: "VALUE_OVERFLOW", date: "2026-01-01" }] })
	})
})
