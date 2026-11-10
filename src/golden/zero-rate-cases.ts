import type { Returns } from "../engine/returns"
import type { Fixture } from "../fixtures/fixture"

const MONTH_STARTS: readonly string[] = [
	"2026-01-01",
	"2026-02-01",
	"2026-03-01",
	"2026-04-01",
	"2026-05-01",
	"2026-06-01",
	"2026-07-01",
	"2026-08-01",
	"2026-09-01",
	"2026-10-01",
	"2026-11-01",
	"2026-12-01",
]

/** A year whose every Account rate is 0, with contributions, a liability and a late Shortfall. */
export const zeroRateFixture: Fixture = {
	baseline: {
		schemaVersion: 1,
		balances: [
			{ account: "cash", amount: 400000 },
			{ account: "savings", amount: 100000 },
			{ account: "loan", amount: 50000 },
		],
	},
	scenario: {
		schemaVersion: 3,
		currency: "THB",
		economy: { inflation: 100 },
		accounts: [
			{ id: "cash", kind: "asset", rate: 0 },
			{ id: "savings", kind: "asset", rate: 0 },
			{ id: "loan", kind: "liability", rate: 0 },
		],
		flows: [
			{
				id: "pay",
				kind: "income",
				earned: true,
				amount: 80000,
				frequency: "monthly",
				start: "2026-01-31",
				growth: { bps: 0 },
			},
			{
				id: "rent",
				kind: "expense",
				amount: 30000,
				frequency: "monthly",
				start: "2026-01-01",
				growth: { bps: 0 },
			},
			{
				id: "save",
				kind: "contribution",
				target: "savings",
				amount: 20000,
				frequency: "monthly",
				start: "2026-01-31",
				growth: { bps: 0 },
			},
			{
				id: "repay",
				kind: "contribution",
				target: "loan",
				amount: 10000,
				frequency: "monthly",
				start: "2026-01-31",
				growth: { bps: 0 },
			},
			{
				id: "shock",
				kind: "expense",
				amount: 5000000,
				frequency: "once",
				start: "2026-12-31",
				growth: { bps: 0 },
			},
		],
		cashflow: {
			surplus: [{ account: "cash" }],
			contribute: ["savings"],
			withdraw: ["cash", "savings"],
		},
	},
	timeline: { start: "2026-01-01", horizon: "2027-01-01", resolution: "day" },
}

/** One many-row series per Account, every row at 0 bps: the factor is the identity. */
export const zeroRateReturns: Returns = {
	returnsVersion: 1,
	series: ["cash", "savings", "loan"].map((account) => ({
		account,
		rows: MONTH_STARTS.map((from) => ({ from, returnBps: 0 })),
	})),
}
