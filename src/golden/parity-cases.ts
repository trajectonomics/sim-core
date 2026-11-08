import type { Fixture } from "../fixtures/fixture"
import { freelancer } from "../fixtures/freelancer"
import { thaiEmployee } from "../fixtures/thai-employee"
import { TH_LIKE } from "../levy/th-levy"

export interface ParityCase {
	readonly name: string
	readonly fixture: Fixture
}

/** One year of 50% growth across Feb 29 2028: a rounding tie plus the No Leap day count. */
const leapTie: Fixture = {
	baseline: { schemaVersion: 1, balances: [{ account: "cash", amount: 1 }] },
	scenario: {
		schemaVersion: 1,
		currency: "THB",
		economy: { inflation: 300 },
		accounts: [{ id: "cash", kind: "asset", rate: 5000 }],
		flows: [],
		cashflow: { surplus: [{ account: "cash" }], withdraw: [] },
	},
	timeline: { start: "2027-02-28", horizon: "2029-03-01", resolution: "day" },
}

/** A calendar-year salary under a TH-like Levy: monthly Prepayment and a 31 March Settlement. */
const levySalary: Fixture = {
	baseline: { schemaVersion: 1, balances: [{ account: "cash", amount: 0 }] },
	scenario: {
		schemaVersion: 1,
		currency: "THB",
		economy: { inflation: 0 },
		accounts: [{ id: "cash", kind: "asset", rate: 0 }],
		flows: [
			{
				id: "salary",
				kind: "income",
				earned: true,
				amount: 10_000_000,
				frequency: "monthly",
				start: "2026-01-31",
				growth: { bps: 0 },
				label: "salary",
				prepaymentBps: 500,
			},
		],
		cashflow: { surplus: [{ account: "cash" }], withdraw: ["cash"] },
		levy: TH_LIKE,
	},
	timeline: { start: "2026-01-01", horizon: "2027-03-31", resolution: "day" },
}

/** Inputs whose Projection must hash identically under every JavaScript engine. */
export const PARITY_CASES: readonly ParityCase[] = [
	{ name: "freelancer-day", fixture: freelancer },
	{
		name: "thai-employee-month",
		fixture: { ...thaiEmployee, timeline: { ...thaiEmployee.timeline, resolution: "month" } },
	},
	{ name: "leap-tie-day", fixture: leapTie },
	{ name: "levy-salary-day", fixture: levySalary },
]
