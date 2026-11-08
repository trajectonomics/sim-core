import type { Fixture } from "../fixtures/fixture"

/** Debt is paid first, then two asset targets share the rest; the lower priority is partly unfunded. */
export const capped: Fixture = {
	baseline: {
		schemaVersion: 1,
		balances: [
			{ account: "savings", amount: 0 },
			{ account: "loan", amount: 500 },
		],
	},
	scenario: {
		schemaVersion: 2,
		currency: "THB",
		economy: { inflation: 100 },
		accounts: [
			{ id: "cash", kind: "asset", rate: 0 },
			{ id: "savings", kind: "asset", rate: 200 },
			{ id: "other", kind: "asset", rate: 300 },
			{ id: "loan", kind: "liability", rate: 100 },
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
				id: "repay",
				kind: "contribution",
				target: "loan",
				amount: 400,
				frequency: "monthly",
				start: "2026-01-31",
				growth: { bps: 0 },
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
