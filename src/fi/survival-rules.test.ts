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

describe("survival stop mechanics", () => {
	it("delays FI until a locked account unlocks", () => {
		const result = fi({
			accounts: [cash, { id: "vault", kind: "asset", rate: 0, lockedUntil: "2026-04-01" }],
			balances: { cash: 0, vault: 1000 },
			flows: [
				income("pay", 100, { frequency: "monthly" }),
				expense("living", 100, { frequency: "monthly" }),
			],
			surplus: [{ account: "cash" }],
			withdraw: ["cash", "vault"],
			horizon: "2026-05-01",
		})
		expect(result).toMatchObject({
			ok: true,
			financialIndependence: { reachable: true, month: "2026-04-01" },
		})
	})

	it("brings FI forward with passive income", () => {
		const passive = { ...income("dividend", 50, { frequency: "monthly" }), earned: false }
		const withPassive = fi({
			accounts: [cash],
			balances: { cash: 0 },
			flows: [
				income("pay", 100, { frequency: "monthly" }),
				passive,
				expense("living", 100, { frequency: "monthly" }),
			],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2026-04-01",
		})
		const withoutPassive = fi({
			accounts: [cash],
			balances: { cash: 0 },
			flows: [
				income("pay", 100, { frequency: "monthly" }),
				expense("living", 100, { frequency: "monthly" }),
			],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2026-04-01",
		})
		expect(withPassive).toMatchObject({
			ok: true,
			financialIndependence: { reachable: true, month: "2026-03-01" },
		})
		expect(withoutPassive).toMatchObject({
			ok: true,
			financialIndependence: { reachable: false },
		})
	})

	it("replaces planned expenses with retirement spending from M", () => {
		const result = fi(
			{
				accounts: [cash],
				balances: { cash: 1000 },
				flows: [expense("big", 2000, { start: "2026-02-01" })],
				surplus: [{ account: "cash" }],
				withdraw: ["cash"],
				horizon: "2026-04-01",
			},
			{ method: "survival", retirementSpending: { amount: 100, growth: { bps: 0 } } },
		)
		expect(result).toMatchObject({
			ok: true,
			financialIndependence: {
				reachable: true,
				month: "2026-01-01",
				definition: {
					method: "survival",
					definitionVersion: 1,
					retirementSpending: { amount: 100, growth: { bps: 0 } },
				},
			},
		})
	})

	it("starts a mid-month timeline at the next month start", () => {
		const result = fi({
			accounts: [cash],
			balances: { cash: 100 },
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			start: "2026-01-15",
			horizon: "2026-03-01",
		})
		expect(result).toMatchObject({
			ok: true,
			financialIndependence: { reachable: true, month: "2026-02-01" },
		})
	})

	it("allows M = horizon", () => {
		const result = fi({
			accounts: [cash],
			balances: { cash: 0 },
			flows: [
				income("pay", 100, { frequency: "monthly" }),
				expense("living", 100, { frequency: "monthly", end: "2026-02-01" }),
			],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2026-03-01",
		})
		expect(result).toMatchObject({
			ok: true,
			financialIndependence: { reachable: true, month: "2026-03-01" },
		})
	})

	it("removes a once earned flow on M and keeps one before M", () => {
		const result = fi({
			accounts: [cash],
			balances: { cash: 0 },
			flows: [
				income("jan", 100, { start: "2026-01-01" }),
				income("feb", 100, { start: "2026-02-01" }),
				expense("jan-bill", 100, { start: "2026-01-01" }),
				expense("feb-bill", 100, { start: "2026-02-01" }),
			],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2026-03-01",
		})
		expect(result).toMatchObject({
			ok: true,
			financialIndependence: { reachable: true, month: "2026-03-01" },
		})
	})

	it("does not use an earned flow that starts after M", () => {
		const result = fi({
			accounts: [cash],
			balances: { cash: 0 },
			flows: [
				income("future-pay", 100, { frequency: "monthly", start: "2026-03-01" }),
				expense("mar", 100, { start: "2026-03-01" }),
				expense("apr", 100, { start: "2026-04-01" }),
			],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2026-04-01",
		})
		expect(result).toMatchObject({
			ok: true,
			financialIndependence: { reachable: false },
		})
	})

	it("reports a shortfall before M with the shortfallBeforeStop binding", () => {
		const result = fi({
			accounts: [cash],
			balances: { cash: 0 },
			flows: [
				income("jan", 100, { start: "2026-01-01" }),
				expense("jan-bill", 100, { start: "2026-01-01" }),
				expense("mid-month", 100, { start: "2026-01-15" }),
			],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2026-02-01",
		})
		expect(result).toMatchObject({
			ok: true,
			financialIndependence: {
				reachable: false,
				binding: "shortfallBeforeStop",
				bestCase: { month: "2026-02-01", runsOut: { date: "2026-01-15", unmet: 100 } },
			},
		})
	})

	it("reports undrawableMoney when locked or unrouted assets cover the shortfall", () => {
		const result = fi({
			accounts: [cash, { id: "vault", kind: "asset", rate: 0, lockedUntil: "2026-06-01" }],
			balances: { cash: 0, vault: 100 },
			flows: [expense("bill", 100, { start: "2026-01-01" })],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2026-01-01",
		})
		expect(result).toMatchObject({
			ok: true,
			financialIndependence: {
				reachable: false,
				binding: "undrawableMoney",
				bestCase: { month: "2026-01-01", runsOut: { date: "2026-01-01", unmet: 100 } },
			},
		})
	})
})
