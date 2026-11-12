import { describe, expect, it } from "bun:test"
import { expense, income } from "../engine/test-flows"
import { makeFixture } from "../engine/test-helpers"
import { financialIndependence } from "../index"
import type { SurvivalOptions } from "../types"

function fi(setup: Parameters<typeof makeFixture>[0], options: SurvivalOptions) {
	const { baseline, scenario, timeline } = makeFixture(setup)
	return financialIndependence(baseline, scenario, timeline, options)
}

function reference(setup: Parameters<typeof makeFixture>[0], options: SurvivalOptions) {
	const result = fi(setup, options)
	if (!result.ok || !result.financialIndependence.reachable) {
		throw new Error(`expected a reachable result, got ${JSON.stringify(result)}`)
	}
	return result.financialIndependence.reference
}

/**
 * One year of 100% inflation. The FI month is 2026-01-01: one thousand a year earlier, one
 * thousand-one hundred at the FI month, 24,700 locked in a pension, and expenses 1,000 at the FI
 * month plus 40 in July 2026 (546 counted days).
 */
const inflation = {
	accounts: [
		{ id: "cash", kind: "asset", rate: 0 },
		{ id: "vault", kind: "asset", rate: 0, lockedUntil: "2099-01-01" },
	],
	balances: { cash: 0, vault: 24_700 },
	flows: [
		income("pay", 100, { frequency: "monthly", start: "2025-02-01" }),
		expense("big", 1000, { start: "2026-01-01" }),
		expense("later", 40, { start: "2026-07-01" }),
	],
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	start: "2025-01-01",
	horizon: "2026-08-01",
	inflation: 10_000,
} as const

describe("reference real terms", () => {
	it("deflates every amount to Timeline.start and computes met from them", () => {
		expect(reference(inflation, { method: "survival", reference: { basis: "allAssets" } })).toEqual(
			{
				label: "ruleOfThumb",
				date: "2026-01-01",
				multiplier: 25,
				basis: "allAssets",
				window: "next12Months",
				terms: "nominal",
				unlockedAssets: 1100,
				numerator: 25_800,
				annualExpenses: 1040,
				threshold: 26_000,
				multipleBps: 248_076,
				partial: false,
				met: false,
			},
		)
		expect(
			reference(inflation, {
				method: "survival",
				reference: { basis: "allAssets", terms: "real" },
			}),
		).toMatchObject({
			terms: "real",
			unlockedAssets: 550,
			numerator: 12_900,
			annualExpenses: 514,
			threshold: 12_850,
			multipleBps: 250_972,
			met: true,
		})
	})

	it("changes met against nominal when the expense falls later in the window", () => {
		const nominal = reference(inflation, {
			method: "survival",
			reference: { basis: "allAssets" },
		})
		const real = reference(inflation, {
			method: "survival",
			reference: { basis: "allAssets", terms: "real" },
		})
		expect(nominal.met).toBe(false)
		expect(real.met).toBe(true)
	})

	it("equals nominal when inflation is zero", () => {
		const setup = { ...inflation, inflation: 0 }
		const nominal = reference(setup, {
			method: "survival",
			reference: { basis: "netWorth" },
		})
		expect(
			reference(setup, { method: "survival", reference: { basis: "netWorth", terms: "real" } }),
		).toEqual({ ...nominal, terms: "real" })
	})
})
