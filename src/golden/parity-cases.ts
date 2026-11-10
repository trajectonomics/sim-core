import type { Fixture } from "../fixtures/fixture"
import { freelancer } from "../fixtures/freelancer"
import { thaiEmployee } from "../fixtures/thai-employee"
import type { SurvivalOptions } from "../types"
import { calendarFiMonth, calendarShiftDay } from "./calendar-cases"
import { capped } from "./contribution-cases"
import { levyJointFilers, wageBaseCase } from "./levy-cap-cases"
import {
	levyCarryInDay,
	levyRefundDay,
	levySalaryDay,
	levySettledMonth,
	levyShortfallDay,
	levyUnsettledMonth,
} from "./levy-cases"
import { levyGainsDay } from "./levy-gains-case"
import { levyReturnsDay } from "./levy-returns-case"
import { levyCareCredit } from "./levy-us-cases"
import { nominalLeapFebruary, nominalPartial, nominalReal, nominalZero } from "./nominal-cases"
import { nominalMonthlyLoan } from "./nominal-flow-cases"

export interface ParityCase {
	readonly name: string
	readonly fixture: Fixture
	readonly options?: SurvivalOptions
}

/** One year of 50% growth across Feb 29 2028: a rounding tie plus the No Leap day count. */
const leapTie: Fixture = {
	baseline: { schemaVersion: 1, balances: [{ account: "cash", amount: 1 }] },
	scenario: {
		schemaVersion: 3,
		currency: "THB",
		economy: { inflation: 300 },
		accounts: [{ id: "cash", kind: "asset", rate: 5000 }],
		flows: [],
		cashflow: { surplus: [{ account: "cash" }], contribute: [], withdraw: [] },
	},
	timeline: { start: "2027-02-28", horizon: "2029-03-01", resolution: "day" },
}

/** Inputs whose Projection and Financial Independence must hash identically under every engine. */
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
<<<<<<< HEAD
	{ name: "levy-care-credit", fixture: levyCareCredit },
	{ name: "levy-wage-base", fixture: wageBaseCase(60_000_000) },
	{ name: "levy-joint-filers", fixture: levyJointFilers },
=======
	{ name: "levy-returns-day", fixture: levyReturnsDay },
	{ name: "levy-gains-day", fixture: levyGainsDay },
>>>>>>> 18980c6 (feat: tally realised gains on a pooled cost basis as a Levy basis)
	{ name: "calendar-shift-day", fixture: calendarShiftDay },
	{ name: "calendar-fi", fixture: calendarFiMonth, options: { method: "survival" } },
	{ name: "freelancer-fi", fixture: freelancer, options: { method: "survival" } },
	{
		name: "thai-employee-fi-buffer",
		fixture: thaiEmployee,
		options: { method: "survival", minBufferMonths: 6 },
	},
	{ name: "nominal-monthly-loan", fixture: nominalMonthlyLoan },
	{ name: "nominal-partial-day", fixture: nominalPartial },
	{ name: "nominal-zero-month", fixture: nominalZero },
	{ name: "nominal-leap-february-day", fixture: nominalLeapFebruary },
	{ name: "nominal-real-month", fixture: nominalReal },
	{
		name: "freelancer-fi-retirement",
		fixture: freelancer,
		options: {
			method: "survival",
			retirementSpending: { amount: 2_000_000, growth: "inflation" },
			minBufferMonths: 3,
		},
	},
]
