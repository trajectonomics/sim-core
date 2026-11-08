import type { Baseline, Scenario, Timeline } from "../types"
import type { Fixture } from "./fixture"

const baseline: Baseline = {
	schemaVersion: 1,
	balances: [
		{ account: "cash", amount: 5_000_000 },
		{ account: "emergency-fund", amount: 30_000_000 },
		{ account: "rmf", amount: 20_000_000 },
		{ account: "mortgage", amount: 250_000_000 },
	],
}

const scenario: Scenario = {
	schemaVersion: 2,
	currency: "THB",
	economy: { inflation: 250 },
	accounts: [
		{ id: "cash", kind: "asset", rate: 50 },
		{ id: "emergency-fund", kind: "asset", rate: 150 },
		{ id: "rmf", kind: "asset", rate: 500, lockedUntil: "2046-01-01" },
		{ id: "mortgage", kind: "liability", rate: 450 },
	],
	flows: [
		{
			id: "salary",
			kind: "income",
			earned: true,
			amount: 6_000_000,
			frequency: "monthly",
			start: "2026-01-25",
			growth: { bps: 300 },
		},
		{
			id: "bonus",
			kind: "income",
			earned: true,
			amount: 12_000_000,
			frequency: "once",
			start: "2026-03-31",
			growth: "inflation",
		},
		{
			id: "living",
			kind: "expense",
			amount: 2_500_000,
			frequency: "monthly",
			start: "2026-01-01",
			growth: "inflation",
		},
		{
			id: "rmf-monthly",
			kind: "contribution",
			target: "rmf",
			amount: 500_000,
			frequency: "monthly",
			start: "2026-01-25",
			end: "2045-12-25",
			growth: { bps: 0 },
		},
		{
			id: "mortgage-payment",
			kind: "contribution",
			target: "mortgage",
			amount: 1_800_000,
			frequency: "monthly",
			start: "2026-01-05",
			end: "2050-12-05",
			growth: { bps: 0 },
		},
	],
	cashflow: {
		contribute: ["rmf"],
		surplus: [{ account: "cash", upTo: 10_000_000 }, { account: "emergency-fund" }],
		withdraw: ["emergency-fund", "cash", "rmf"],
	},
}

const timeline: Timeline = { start: "2026-01-01", horizon: "2056-01-01", resolution: "month" }

export const thaiEmployee: Fixture = { baseline, scenario, timeline }
