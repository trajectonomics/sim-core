import { describe, expect, it } from "bun:test"
import { expense } from "../engine/test-flows"
import { makeFixture } from "../engine/test-helpers"
import { financialIndependence } from "../index"
import type { SurvivalOptions } from "../types"
import type { RuleOfThumbReference } from "../types/reference"

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

const ledger = {
	accounts: [
		{ id: "cash", kind: "asset", rate: 0 },
		{ id: "vault", kind: "asset", rate: 0, lockedUntil: "2026-06-01" },
		{ id: "loan", kind: "liability", rate: 0 },
	],
	balances: { cash: 10_000, vault: 5_000, loan: 2_000 },
	flows: [expense("living", 100, { frequency: "monthly", start: "2026-01-10" })],
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	horizon: "2026-02-01",
} as const

describe("the reference multiplier and basis", () => {
	it("keeps the 25×, unlocked-asset default and reports every field", () => {
		expect(reference(ledger, { method: "survival" })).toEqual({
			label: "ruleOfThumb",
			date: "2026-01-01",
			multiplier: 25,
			basis: "unlockedAssets",
			window: "next12Months",
			terms: "nominal",
			unlockedAssets: 10_000,
			numerator: 10_000,
			annualExpenses: 1200,
			threshold: 30_000,
			multipleBps: 83_333,
			partial: false,
			met: false,
		})
	})

	it("counts every asset, locked or not, under allAssets", () => {
		expect(
			reference(ledger, { method: "survival", reference: { basis: "allAssets" } }),
		).toMatchObject({
			basis: "allAssets",
			unlockedAssets: 10_000,
			numerator: 15_000,
			multipleBps: 125_000,
			met: false,
		})
	})

	it("subtracts liabilities but leaves locked assets out under accessibleNetWorth", () => {
		expect(
			reference(ledger, { method: "survival", reference: { basis: "accessibleNetWorth" } }),
		).toMatchObject({
			basis: "accessibleNetWorth",
			unlockedAssets: 10_000,
			numerator: 8_000,
			multipleBps: 66_666,
			met: false,
		})
	})

	it("subtracts liabilities and counts locked assets under netWorth", () => {
		expect(
			reference(ledger, { method: "survival", reference: { basis: "netWorth" } }),
		).toMatchObject({
			basis: "netWorth",
			unlockedAssets: 10_000,
			numerator: 13_000,
			multipleBps: 108_333,
			met: false,
		})
	})

	it("uses a configured multiplier for threshold and met, never for the multiple", () => {
		const configured = reference(ledger, {
			method: "survival",
			reference: { basis: "netWorth", multiplier: 3 },
		})
		expect(configured).toMatchObject({
			multiplier: 3,
			numerator: 13_000,
			threshold: 3600,
			multipleBps: 108_333,
			met: true,
		})
	})

	it("floors a half multiple down to the integer basis point", () => {
		expect(
			reference(
				{
					accounts: [
						{ id: "cash", kind: "asset", rate: 0 },
						{ id: "loan", kind: "liability", rate: 0 },
					],
					balances: { cash: 35, loan: 32 },
					flows: [expense("bill", 32, { start: "2026-01-10" })],
					surplus: [{ account: "cash" }],
					withdraw: ["cash"],
					horizon: "2026-02-01",
				},
				{ method: "survival", reference: { basis: "netWorth" } },
			),
		).toMatchObject({ numerator: 3, annualExpenses: 32, multipleBps: 937, met: false })
	})

	it("floors a negative multiple toward negative infinity, not toward zero", () => {
		expect(
			reference(
				{
					accounts: [
						{ id: "cash", kind: "asset", rate: 0 },
						{ id: "loan", kind: "liability", rate: 0 },
					],
					balances: { cash: 1000, loan: 2000 },
					flows: [expense("living", 100, { frequency: "monthly", start: "2026-01-10" })],
					surplus: [{ account: "cash" }],
					withdraw: ["cash"],
					horizon: "2026-02-01",
				},
				{ method: "survival", reference: { basis: "netWorth" } },
			),
		).toMatchObject({ numerator: -1000, annualExpenses: 1200, multipleBps: -8334, met: false })
	})

	it("omits the multiple at zero expenses and treats a negative numerator as not met", () => {
		const result = reference(
			{
				accounts: [
					{ id: "cash", kind: "asset", rate: 0 },
					{ id: "loan", kind: "liability", rate: 0 },
				],
				balances: { cash: 0, loan: 100 },
				surplus: [{ account: "cash" }],
				withdraw: ["cash"],
				horizon: "2026-01-01",
			},
			{ method: "survival", reference: { basis: "netWorth" } },
		)
		expect(result).toMatchObject({ numerator: -100, annualExpenses: 0, threshold: 0, met: false })
		expect(result).not.toHaveProperty("multipleBps")
	})

	it("is absent from an unreachable answer", () => {
		const result = fi(
			{
				accounts: [{ id: "cash", kind: "asset", rate: 0 }],
				balances: { cash: 0 },
				flows: [expense("living", 100, { frequency: "monthly" })],
				surplus: [{ account: "cash" }],
				withdraw: ["cash"],
				horizon: "2026-03-01",
			},
			{ method: "survival", reference: { multiplier: 30, basis: "netWorth" } },
		)
		if (!result.ok || result.financialIndependence.reachable) throw new Error("expected a failure")
		expect(result.financialIndependence).not.toHaveProperty("reference")
	})

	it("reports the type under its new name and keeps the old one as an alias", () => {
		const typed: RuleOfThumbReference = reference(ledger, { method: "survival" })
		expect(typed.label).toBe("ruleOfThumb")
	})
})
