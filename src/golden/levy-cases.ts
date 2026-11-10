import { prepays } from "../engine/test-flows"
import { emptyCarryIn, withCarryIn } from "../engine/test-helpers"
import type { Fixture } from "../fixtures/fixture"
import { TH_LIKE } from "../levy/th-levy"
import type { BasisPoints, CarryIn, DateString, IncomeFlow, Resolution } from "../types"

interface SalaryCase {
	readonly prepaymentBps: BasisPoints
	readonly horizon: DateString
	readonly resolution: Resolution
	readonly start?: DateString
	readonly end?: DateString
	readonly withdraw?: readonly string[]
	readonly carryIn?: readonly CarryIn[]
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
		prepayments: prepays(TH_LIKE.id, prepaymentBps),
	}
}

function salaryFixture(options: SalaryCase): Fixture {
	return {
		baseline: { schemaVersion: 1, balances: [{ account: "cash", amount: 0 }] },
		scenario: {
			schemaVersion: 4,
			currency: "THB",
			economy: { inflation: 0 },
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			flows: [salaryFlow(options.prepaymentBps, options.end)],
			cashflow: {
				surplus: [{ account: "cash" }],
				contribute: [],
				withdraw: options.withdraw ?? ["cash"],
			},
			levies: [withCarryIn(TH_LIKE, ...(options.carryIn ?? [emptyCarryIn("2025-01-01")]))],
		},
		timeline: {
			start: options.start ?? "2026-01-01",
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

export const levyCarryInDay: Fixture = salaryFixture({
	prepaymentBps: 500,
	horizon: "2027-03-31",
	resolution: "day",
	start: "2026-06-01",
	carryIn: [
		{
			periodStart: "2026-01-01",
			tallies: [{ label: "salary", basis: "gross", amount: 50_000_000 }],
			prepaid: 2_500_000,
		},
	],
})
