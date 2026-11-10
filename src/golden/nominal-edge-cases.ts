import { contribution, income } from "../engine/test-flows"
import type { Fixture } from "../fixtures/fixture"
import type { Account } from "../types"

const cash: Account = { id: "cash", kind: "asset", rate: 0 }
const loan: Account = { id: "loan", kind: "liability", rate: 1200, compounding: "monthly" }
const savings: Account = { id: "savings", kind: "asset", rate: 1200, compounding: "monthly" }

/** A Liability paid off exactly on a compounding date, at day resolution. */
export const nominalPayoffOnDate: Fixture = {
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
			income("pay", 1_212_000, { start: "2026-04-30" }),
			contribution("repay", "loan", 1_212_000, { start: "2026-04-30" }),
		],
		cashflow: { surplus: [{ account: "cash" }], contribute: [], withdraw: ["cash"] },
	},
	timeline: { start: "2026-03-31", horizon: "2026-04-30", resolution: "day" },
}

/** A credit that lands on Feb 29, at day resolution. */
export const nominalLeapFlow: Fixture = {
	baseline: {
		schemaVersion: 1,
		balances: [
			{ account: "cash", amount: 0 },
			{ account: "savings", amount: 1_200_000 },
		],
	},
	scenario: {
		schemaVersion: 3,
		currency: "THB",
		economy: { inflation: 0 },
		accounts: [cash, savings],
		flows: [
			income("bonus", 100_000, { start: "2024-02-29" }),
			contribution("save", "savings", 100_000, { start: "2024-02-29" }),
		],
		cashflow: { surplus: [{ account: "cash" }], contribute: ["savings"], withdraw: [] },
	},
	timeline: { start: "2024-01-31", horizon: "2024-03-31", resolution: "day" },
}

export const EDGE_NOMINAL_CASES: readonly Fixture[] = [nominalPayoffOnDate, nominalLeapFlow]
