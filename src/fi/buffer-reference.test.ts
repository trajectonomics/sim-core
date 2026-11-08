import { describe, expect, it } from "bun:test"
import { expense } from "../engine/test-flows"
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
const bufferSetup = {
	accounts: [cash],
	balances: { cash: 1200 },
	flows: [expense("living", 100, { frequency: "monthly" })],
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	horizon: "2026-12-31",
} as const

describe("minimum buffer", () => {
	it("reports the worked breach at the first month with no accessible money", () => {
		expect(fi(bufferSetup, { method: "survival", minBufferMonths: 1 })).toMatchObject({
			ok: true,
			financialIndependence: {
				reachable: false,
				binding: "minimumBuffer",
				bestCase: {
					month: "2026-01-01",
					bufferBreach: { date: "2026-12-01", required: 100, accessible: 0 },
				},
			},
		})
	})

	it("treats an omitted buffer and zero the same", () => {
		const omitted = fi(bufferSetup)
		const zero = fi(bufferSetup, { method: "survival", minBufferMonths: 0 })
		expect(zero).toMatchObject({ ok: true })
		expect(omitted).toMatchObject({ ok: true })
		if (!omitted.ok || !zero.ok) throw new Error("expected ok results")
		expect({
			...zero.financialIndependence,
			definition: omitted.financialIndependence.definition,
		}).toEqual(omitted.financialIndependence)
	})

	it("keeps walking after a breach so a later shortfall wins the binding", () => {
		expect(
			fi(
				{
					...bufferSetup,
					flows: [
						expense("living", 100, { frequency: "monthly" }),
						expense("final", 5000, { start: "2026-12-31" }),
					],
				},
				{ method: "survival", minBufferMonths: 1 },
			),
		).toMatchObject({
			ok: true,
			financialIndependence: {
				reachable: false,
				binding: "insufficientMoney",
				bestCase: { month: "2026-01-01", runsOut: { date: "2026-12-31", unmet: 5000 } },
			},
		})
	})

	it("requires accessible net worth to be at least zero with zero expenses", () => {
		expect(
			fi(
				{
					accounts: [cash, { id: "loan", kind: "liability", rate: 0 }],
					balances: { cash: 0, loan: 100 },
					surplus: [{ account: "cash" }],
					withdraw: ["cash"],
					horizon: "2026-01-01",
				},
				{ method: "survival", minBufferMonths: 1 },
			),
		).toMatchObject({
			ok: true,
			financialIndependence: {
				reachable: false,
				binding: "minimumBuffer",
				bestCase: {
					month: "2026-01-01",
					bufferBreach: { date: "2026-01-01", required: 0, accessible: -100 },
				},
			},
		})
	})
})

describe("25× rule-of-thumb reference", () => {
	it("rounds the multiple down", () => {
		expect(
			fi({
				accounts: [cash],
				balances: { cash: 2000 },
				flows: [expense("living", 100, { frequency: "monthly" })],
				surplus: [{ account: "cash" }],
				withdraw: ["cash"],
				horizon: "2026-02-01",
			}),
		).toMatchObject({
			ok: true,
			financialIndependence: {
				reachable: true,
				reference: {
					label: "ruleOfThumb25x",
					date: "2026-01-01",
					unlockedAssets: 2000,
					annualExpenses: 1200,
					threshold: 30_000,
					multipleBps: 16_666,
					met: false,
				},
			},
		})
	})

	it("meets the threshold exactly", () => {
		expect(
			fi({
				accounts: [cash],
				balances: { cash: 30_000 },
				flows: [expense("living", 100, { frequency: "monthly" })],
				surplus: [{ account: "cash" }],
				withdraw: ["cash"],
				horizon: "2026-02-01",
			}),
		).toMatchObject({
			ok: true,
			financialIndependence: {
				reference: {
					unlockedAssets: 30_000,
					annualExpenses: 1200,
					threshold: 30_000,
					multipleBps: 250_000,
					met: true,
				},
			},
		})
	})

	it("omits the multiple when annual expenses are zero", () => {
		const result = fi({
			accounts: [cash],
			balances: { cash: 100 },
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2026-02-01",
		})
		expect(result).toMatchObject({
			ok: true,
			financialIndependence: {
				reference: {
					unlockedAssets: 100,
					annualExpenses: 0,
					threshold: 0,
					met: true,
				},
			},
		})
		if (!result.ok || result.financialIndependence.reachable !== true) {
			throw new Error("expected a reachable result")
		}
		expect(result.financialIndependence.reference).not.toHaveProperty("multipleBps")
	})
})
