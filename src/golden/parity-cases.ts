import type { Fixture } from "../fixtures/fixture"
import { freelancer } from "../fixtures/freelancer"
import { thaiEmployee } from "../fixtures/thai-employee"
import { capped } from "./contribution-cases"
import {
	levyCarryInDay,
	levyRefundDay,
	levySalaryDay,
	levySettledMonth,
	levyShortfallDay,
	levyUnsettledMonth,
} from "./levy-cases"

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

/** Inputs whose Projection must hash identically under every JavaScript engine. */
export const PARITY_CASES: readonly ParityCase[] = [
	{ name: "freelancer-day", fixture: freelancer },
	{
		name: "thai-employee-month",
		fixture: { ...thaiEmployee, timeline: { ...thaiEmployee.timeline, resolution: "month" } },
	},
	{ name: "leap-tie-day", fixture: leapTie },
	{ name: "capped-month", fixture: capped },
	{ name: "levy-salary-day", fixture: levySalaryDay },
	{ name: "levy-settled-month", fixture: levySettledMonth },
	{ name: "levy-refund-day", fixture: levyRefundDay },
	{ name: "levy-shortfall-day", fixture: levyShortfallDay },
	{ name: "levy-unsettled-month", fixture: levyUnsettledMonth },
	{ name: "levy-carry-in-day", fixture: levyCarryInDay },
]
