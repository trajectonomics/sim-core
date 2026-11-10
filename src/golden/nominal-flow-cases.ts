import { contribution, income } from "../engine/test-flows"
import type { Fixture } from "../fixtures/fixture"
import type { Account } from "../types"

const cash: Account = { id: "cash", kind: "asset", rate: 0 }
const loan: Account = { id: "loan", kind: "liability", rate: 1200, compounding: "monthly" }

/** A nominal Liability paid down monthly, mid-period, at month resolution. */
export const nominalMonthlyLoan: Fixture = {
	baseline: {
		schemaVersion: 1,
		balances: [
			{ account: "cash", amount: 0 },
			{ account: "loan", amount: 9_000_000 },
		],
	},
	scenario: {
		schemaVersion: 3,
		currency: "THB",
		economy: { inflation: 200 },
		accounts: [cash, loan],
		flows: [
			income("pay", 300_000, { frequency: "monthly", start: "2026-01-15", growth: "inflation" }),
			contribution("repay", "loan", 300_000, { frequency: "monthly", start: "2026-01-15" }),
		],
		cashflow: { surplus: [{ account: "cash" }], contribute: [], withdraw: ["cash"] },
	},
	timeline: { start: "2025-12-31", horizon: "2028-01-01", resolution: "month" },
}

/** The overdrawing payment that capitalises early, at day resolution. */
export const nominalOverdraw: Fixture = {
	baseline: {
		schemaVersion: 1,
		balances: [
			{ account: "cash", amount: 0 },
			{ account: "loan", amount: 1_200_000 },
		],
	},
	scenario: {
		schemaVersion: 3,
		currency: "THB",
		economy: { inflation: 0 },
		accounts: [cash, loan],
		flows: [
			income("pay", 1_203_000, { start: "2026-04-16" }),
			contribution("repay", "loan", 1_203_000, { start: "2026-04-16" }),
		],
		cashflow: { surplus: [{ account: "cash" }], contribute: [], withdraw: ["cash"] },
	},
	timeline: { start: "2026-04-01", horizon: "2026-04-30", resolution: "day" },
}

/** Nominal interest deepens a Shortfall into a Runs-out date. */
export const nominalShortfall: Fixture = {
	baseline: {
		schemaVersion: 1,
		balances: [
			{ account: "cash", amount: 0 },
			{ account: "loan", amount: 1_000_000 },
		],
	},
	scenario: {
		schemaVersion: 3,
		currency: "THB",
		economy: { inflation: 0 },
		accounts: [cash, loan],
		flows: [
			income("pay", 1_000_000, { start: "2026-01-31" }),
			contribution("repay", "loan", 1_010_000, { start: "2026-01-31" }),
		],
		cashflow: { surplus: [{ account: "cash" }], contribute: [], withdraw: ["cash"] },
	},
	timeline: { start: "2025-12-31", horizon: "2026-01-31", resolution: "day" },
}

export const FLOW_NOMINAL_CASES: readonly Fixture[] = [
	nominalMonthlyLoan,
	nominalOverdraw,
	nominalShortfall,
]
