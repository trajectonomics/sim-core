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

const trailing: SurvivalOptions = { method: "survival", reference: { window: "trailing12Months" } }

/** 100 income and 30 living a month from January 2025, then 800 at the FI month 2026-01-01. */
const full = {
	accounts: [{ id: "cash", kind: "asset", rate: 0 }],
	balances: { cash: 0 },
	flows: [
		income("pay", 100, { frequency: "monthly", start: "2025-01-01" }),
		expense("living", 30, { frequency: "monthly", start: "2025-01-01" }),
		expense("big", 800, { start: "2026-01-01" }),
	],
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	start: "2025-01-01",
	horizon: "2026-01-02",
} as const

describe("reference trailing-twelve-month window", () => {
	it("sums the original-plan expenses in the twelve months before the FI month", () => {
		expect(reference(full, trailing)).toEqual({
			label: "ruleOfThumb",
			date: "2026-01-01",
			multiplier: 25,
			basis: "unlockedAssets",
			window: "trailing12Months",
			terms: "nominal",
			unlockedAssets: 840,
			numerator: 840,
			annualExpenses: 360,
			threshold: 9000,
			multipleBps: 23_333,
			partial: false,
			met: false,
		})
	})

	it("clips the window to Timeline.start and marks it partial", () => {
		const clipped = {
			...full,
			flows: [
				income("pay", 100, { frequency: "monthly", start: "2025-04-01" }),
				expense("living", 30, { frequency: "monthly", start: "2025-04-01" }),
				expense("big", 600, { start: "2026-01-01" }),
			],
			start: "2025-04-01",
		} as const
		expect(reference(clipped, trailing)).toMatchObject({
			date: "2026-01-01",
			unlockedAssets: 630,
			annualExpenses: 270,
			partial: true,
			multipleBps: 23_333,
		})
	})

	it("ignores retirementSpending, which replaces only the next-window expenses", () => {
		expect(
			reference(full, {
				method: "survival",
				retirementSpending: { amount: 90, growth: { bps: 0 } },
				reference: { window: "trailing12Months" },
			}),
		).toMatchObject({ date: "2025-09-01", annualExpenses: 240, partial: true })
	})

	it("uses Landed dates when a Calendar moves an expense", () => {
		const calendar = {
			calendar: { dayRule: "next" as const, holidays: ["2025-12-01", "2025-11-01"] },
		}
		expect(reference({ ...full, ...calendar }, trailing)).toMatchObject({
			annualExpenses: 360,
			partial: false,
		})
	})

	it("marks a next window that runs past the last supported date partial", () => {
		expect(
			reference(
				{
					accounts: [{ id: "cash", kind: "asset", rate: 0 }],
					balances: { cash: 1000 },
					surplus: [{ account: "cash" }],
					withdraw: ["cash"],
					start: "9998-06-01",
					horizon: "9998-06-01",
				},
				{ method: "survival" },
			),
		).toMatchObject({ date: "9998-06-01", annualExpenses: 0, partial: true, met: true })
	})
})
