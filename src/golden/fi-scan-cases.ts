/** The frozen FI scan cases; `fi-snapshots.json` records what each one returned before #19 changed the scan. */
import { generateCases } from "../fi/scan-generator"
import type { Fixture } from "../fixtures/fixture"
import { freelancer } from "../fixtures/freelancer"
import { thaiEmployee } from "../fixtures/thai-employee"
import type { SurvivalOptions } from "../types"
import { calendarFiMonth } from "./calendar-cases"
import { capped } from "./contribution-cases"
import { beforeStop, insufficient, noCandidate, overflow, undrawable } from "./fi-scan-edge-cases"
import { levySalaryDay } from "./levy-cases"

export interface ScanCase {
	readonly name: string
	readonly fixture: Fixture
	readonly options: SurvivalOptions
}

function shortened(fixture: Fixture, horizon: string): Fixture {
	return { ...fixture, timeline: { ...fixture.timeline, horizon, resolution: "month" } }
}

const retirementSpending = { amount: 2_000_000, growth: "inflation" } as const

const generated: readonly ScanCase[] = generateCases(8, 2n).map((item) => ({
	name: `generated-${item.name}`,
	fixture: item.fixture,
	options: item.options,
}))

export const SCAN_CASES: readonly ScanCase[] = [
	{
		name: "freelancer",
		fixture: shortened(freelancer, "2031-01-01"),
		options: { method: "survival" },
	},
	{
		name: "freelancer-buffer",
		fixture: shortened(freelancer, "2031-01-01"),
		options: { method: "survival", minBufferMonths: 6 },
	},
	{ name: "thai", fixture: shortened(thaiEmployee, "2033-01-01"), options: { method: "survival" } },
	{
		name: "thai-buffer",
		fixture: shortened(thaiEmployee, "2033-01-01"),
		options: { method: "survival", minBufferMonths: 6 },
	},
	{
		name: "freelancer-retirement-buffer",
		fixture: freelancer,
		options: {
			method: "survival",
			retirementSpending,
			minBufferMonths: 3,
		},
	},
	{ name: "calendar", fixture: calendarFiMonth, options: { method: "survival" } },
	{ name: "capped", fixture: capped, options: { method: "survival" } },
	{ name: "levy", fixture: levySalaryDay, options: { method: "survival" } },
	{
		name: "minimum-buffer",
		fixture: shortened(thaiEmployee, "2033-01-01"),
		options: { method: "survival", minBufferMonths: 12 },
	},
	{ name: "overflow", fixture: overflow, options: { method: "survival" } },
	{ name: "no-candidate", fixture: noCandidate, options: { method: "survival" } },
	{ name: "undrawable", fixture: undrawable, options: { method: "survival" } },
	{ name: "insufficient", fixture: insufficient, options: { method: "survival" } },
	{ name: "before-stop", fixture: beforeStop, options: { method: "survival" } },
	...generated,
]
