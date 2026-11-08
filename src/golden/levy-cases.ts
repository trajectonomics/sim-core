import type { Fixture } from "../fixtures/fixture"
import { TH_LIKE } from "../levy/th-levy"
import type { BasisPoints, DateString, IncomeFlow, Resolution } from "../types"

interface SalaryCase {
	readonly prepaymentBps: BasisPoints
	readonly horizon: DateString
	readonly resolution: Resolution
	readonly end?: DateString
	readonly withdraw?: readonly string[]
}

function salaryFlow(prepaymentBps: BasisPoints, end: DateString | undefined): IncomeFlow {
	return {
		id: "salary",
		kind: "income",
		earned: true,
		amount: 10_000_000,
		frequency: "monthly",
		start: "2026-01-31",
		...(end === undefined ? {} : { end }),
		growth: { bps: 0 },
		label: "salary",
		prepaymentBps,
	}
}

function salaryFixture(options: SalaryCase): Fixture {
	return {
		baseline: { schemaVersion: 1, balances: [{ account: "cash", amount: 0 }] },
		scenario: {
			schemaVersion: 1,
			currency: "THB",
			economy: { inflation: 0 },
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			flows: [salaryFlow(options.prepaymentBps, options.end)],
			cashflow: {
				surplus: [{ account: "cash" }],
				withdraw: options.withdraw ?? ["cash"],
			},
			levy: TH_LIKE,
		},
		timeline: {
			start: "2026-01-01",
			horizon: options.horizon,
			resolution: options.resolution,
		},
	}
}

export const levySalaryDay: Fixture = salaryFixture({
	prepaymentBps: 500,
	horizon: "2027-03-31",
	resolution: "day",
})

export const levySettledMonth: Fixture = salaryFixture({
	prepaymentBps: 500,
	horizon: "2027-03-31",
	resolution: "month",
})

export const levyRefundDay: Fixture = salaryFixture({
	prepaymentBps: 1000,
	horizon: "2027-03-31",
	resolution: "day",
})

export const levyShortfallDay: Fixture = salaryFixture({
	prepaymentBps: 500,
	end: "2026-12-31",
	withdraw: [],
	horizon: "2027-03-31",
	resolution: "day",
})

export const levyUnsettledMonth: Fixture = salaryFixture({
	prepaymentBps: 500,
	horizon: "2026-12-31",
	resolution: "month",
})
