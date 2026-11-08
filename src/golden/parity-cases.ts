import type { Fixture } from "../fixtures/fixture"
import { freelancer } from "../fixtures/freelancer"
import { thaiEmployee } from "../fixtures/thai-employee"

export interface ParityCase {
	readonly name: string
	readonly fixture: Fixture
}

/** One year of 50% growth across Feb 29 2028: a rounding tie plus the No Leap day count. */
const leapTie: Fixture = {
	baseline: { schemaVersion: 1, balances: [{ account: "cash", amount: 1 }] },
	scenario: {
		schemaVersion: 2,
		currency: "THB",
		economy: { inflation: 300 },
		accounts: [{ id: "cash", kind: "asset", rate: 5000 }],
		flows: [],
		cashflow: { surplus: [{ account: "cash" }], contribute: [], withdraw: [] },
	},
	timeline: { start: "2027-02-28", horizon: "2029-03-01", resolution: "day" },
}

/** Two asset targets share a tight income; the lower priority target is partly unfunded. */
const capped: Fixture = {
	baseline: { schemaVersion: 1, balances: [{ account: "savings", amount: 0 }] },
	scenario: {
		schemaVersion: 2,
		currency: "THB",
		economy: { inflation: 100 },
		accounts: [
			{ id: "cash", kind: "asset", rate: 0 },
			{ id: "savings", kind: "asset", rate: 200 },
			{ id: "other", kind: "asset", rate: 300 },
		],
		flows: [
			{
				id: "pay",
				kind: "income",
				earned: true,
				amount: 1000,
				frequency: "monthly",
				start: "2026-01-31",
				growth: { bps: 50 },
			},
			{
				id: "save-savings",
				kind: "contribution",
				target: "savings",
				amount: 800,
				frequency: "monthly",
				start: "2026-01-31",
				growth: { bps: 0 },
			},
			{
				id: "save-other",
				kind: "contribution",
				target: "other",
				amount: 700,
				frequency: "monthly",
				start: "2026-01-31",
				growth: { bps: 0 },
			},
		],
		cashflow: {
			surplus: [{ account: "cash" }],
			contribute: ["other", "savings"],
			withdraw: ["cash"],
		},
	},
	timeline: { start: "2026-01-01", horizon: "2026-06-30", resolution: "month" },
}

/** Inputs whose Projection must hash identically under every JavaScript engine. */
export const PARITY_CASES: readonly ParityCase[] = [
	{ name: "freelancer-day", fixture: freelancer },
	{
		name: "thai-employee-month",
		fixture: { ...thaiEmployee, timeline: { ...thaiEmployee.timeline, resolution: "month" } },
	},
	{ name: "leap-tie-day", fixture: leapTie },
	{ name: "capped-month", fixture: capped },
]
