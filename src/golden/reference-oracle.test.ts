import { describe, expect, it } from "bun:test"
import { expense, income } from "../engine/test-flows"
import { makeFixture } from "../engine/test-helpers"
import type { Fixture } from "../fixtures/fixture"
import { freelancer } from "../fixtures/freelancer"
import { thaiEmployee } from "../fixtures/thai-employee"
import { financialIndependence } from "../index"
import type { SurvivalOptions } from "../types"
import type { ReferenceOptions, RuleOfThumbReference } from "../types/reference"
import { oracleFiMonth } from "./oracle-fi"
import { oracleReference } from "./oracle-reference"

interface Case {
	readonly name: string
	readonly fixture: Fixture
	readonly options: SurvivalOptions
}

function shortened(fixture: Fixture, horizon: string): Fixture {
	return { ...fixture, timeline: { ...fixture.timeline, horizon } }
}

const inflation = makeFixture({
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
})

const trailing = makeFixture({
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
})

const ref = (reference: ReferenceOptions): SurvivalOptions => ({ method: "survival", reference })

const cases: readonly Case[] = [
	{
		name: "freelancer default",
		fixture: shortened(freelancer, "2040-01-01"),
		options: { method: "survival" },
	},
	{
		name: "thai employee net worth",
		fixture: shortened(thaiEmployee, "2040-01-01"),
		options: ref({ basis: "netWorth", multiplier: 30 }),
	},
	{ name: "inflation allAssets", fixture: inflation, options: ref({ basis: "allAssets" }) },
	{
		name: "inflation real",
		fixture: inflation,
		options: ref({ basis: "allAssets", terms: "real" }),
	},
	{ name: "trailing", fixture: trailing, options: ref({ window: "trailing12Months" }) },
	{
		name: "trailing real",
		fixture: trailing,
		options: ref({ window: "trailing12Months", terms: "real" }),
	},
]

function reached(item: Case): { readonly month: string; readonly reference: RuleOfThumbReference } {
	const { baseline, scenario, timeline } = item.fixture
	const result = financialIndependence(baseline, scenario, timeline, item.options)
	if (!result.ok || !result.financialIndependence.reachable) {
		throw new Error(`expected a reachable result for ${item.name}`)
	}
	return result.financialIndependence
}

function expectedReference(item: Case, month: string): RuleOfThumbReference {
	const expected = oracleReference(item.fixture, month, item.options.reference)
	if (expected === undefined) throw new Error(`expected an oracle reference for ${item.name}`)
	return {
		label: "ruleOfThumb",
		date: month,
		multiplier: item.options.reference?.multiplier ?? 25,
		basis: item.options.reference?.basis ?? "unlockedAssets",
		window: item.options.reference?.window ?? "next12Months",
		terms: item.options.reference?.terms ?? "nominal",
		unlockedAssets: Number(expected.unlockedAssets),
		numerator: Number(expected.numerator),
		annualExpenses: Number(expected.annualExpenses),
		threshold: Number(expected.threshold),
		...(expected.multipleBps === undefined ? {} : { multipleBps: Number(expected.multipleBps) }),
		partial: expected.partial,
		met: expected.met,
	}
}

describe("the reference matches the independent oracle", () => {
	it.each(cases.map((item) => [item.name, item] as const))("%s", (_name, item) => {
		const { month, reference } = reached(item)
		expect(oracleFiMonth(item.fixture, item.options)).toBe(month)
		expect(reference).toEqual(expectedReference(item, month))
	})
})
