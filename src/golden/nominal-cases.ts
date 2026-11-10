import { income } from "../engine/test-flows"
import type { Fixture } from "../fixtures/fixture"
import type { Account, CompoundingPeriod } from "../types"

const cash: Account = { id: "cash", kind: "asset", rate: 0 }

/** A nominal Account alone, with only a surplus route, at month resolution. */
function quietAsset(account: Account, start: string, horizon: string, inflation = 0): Fixture {
	return {
		baseline: { schemaVersion: 1, balances: [{ account: account.id, amount: 1_000_000 }] },
		scenario: {
			schemaVersion: 4,
			currency: "THB",
			economy: { inflation },
			accounts: [account],
			flows: [],
			cashflow: { surplus: [{ account: account.id }], contribute: [], withdraw: [] },
		},
		timeline: { start, horizon, resolution: "month" },
	}
}

function asset(compounding: CompoundingPeriod, rate: number): Account {
	return { id: "savings", kind: "asset", rate, compounding }
}

export const nominalQuarterly: Fixture = quietAsset(
	asset("quarterly", 800),
	"2025-12-31",
	"2028-01-01",
)
export const nominalSemiannual: Fixture = quietAsset(
	asset("semiannual", 600),
	"2025-12-31",
	"2028-01-01",
)
export const nominalAnnual: Fixture = quietAsset(asset("annual", 700), "2025-12-31", "2028-01-01")
export const nominalZero: Fixture = quietAsset(asset("monthly", 0), "2025-12-31", "2027-01-01")
export const nominalReal: Fixture = quietAsset(
	asset("monthly", 1200),
	"2025-12-31",
	"2027-01-01",
	200,
)

/** A partial first period with a mid-period credit, at day resolution. */
export const nominalPartial: Fixture = {
	baseline: {
		schemaVersion: 1,
		balances: [
			{ account: "cash", amount: 0 },
			{ account: "savings", amount: 1_200_000 },
		],
	},
	scenario: {
		schemaVersion: 4,
		currency: "THB",
		economy: { inflation: 0 },
		accounts: [cash, asset("monthly", 1200)],
		flows: [income("bonus", 10_000, { start: "2026-02-10" })],
		cashflow: { surplus: [{ account: "cash" }], contribute: [], withdraw: [] },
	},
	timeline: { start: "2026-01-16", horizon: "2026-03-31", resolution: "day" },
}

/** Leap February, at day resolution. */
export const nominalLeapFebruary: Fixture = {
	baseline: { schemaVersion: 1, balances: [{ account: "savings", amount: 1_200_000 }] },
	scenario: {
		schemaVersion: 4,
		currency: "THB",
		economy: { inflation: 0 },
		accounts: [asset("monthly", 1200)],
		flows: [],
		cashflow: { surplus: [{ account: "savings" }], contribute: [], withdraw: [] },
	},
	timeline: { start: "2024-01-31", horizon: "2024-04-30", resolution: "day" },
}

export const NOMINAL_CASES: readonly Fixture[] = [
	nominalQuarterly,
	nominalSemiannual,
	nominalAnnual,
	nominalZero,
	nominalReal,
	nominalPartial,
	nominalLeapFebruary,
]
