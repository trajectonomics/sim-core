import type { Baseline, Scenario, Timeline } from "../types"
import type { Fixture } from "./fixture"

const baseline: Baseline = {
	schemaVersion: 1,
	balances: [
		{ account: "cash", amount: 15_000_000 },
		{ account: "tax-reserve", amount: 2_000_000 },
		{ account: "ssf", amount: 8_000_000 },
		{ account: "equipment-loan", amount: 9_000_000 },
	],
}

const scenario: Scenario = {
	schemaVersion: 4,
	currency: "THB",
	economy: { inflation: 200 },
	accounts: [
		{ id: "cash", kind: "asset", rate: 0 },
		{ id: "tax-reserve", kind: "asset", rate: 100 },
		{ id: "ssf", kind: "asset", rate: 450, lockedUntil: "2036-06-30" },
		{ id: "equipment-loan", kind: "liability", rate: 700 },
		{ id: "brokerage", kind: "asset", rate: 600 },
	],
	flows: [
		{
			id: "client-retainer",
			kind: "income",
			earned: true,
			amount: 4_500_000,
			frequency: "monthly",
			start: "2026-01-31",
			growth: "inflation",
		},
		{
			id: "project-fee",
			kind: "income",
			earned: true,
			amount: 2_000_000,
			frequency: "quarterly",
			start: "2026-02-15",
			end: "2031-02-15",
			growth: { bps: 0 },
		},
		{
			id: "dividend",
			kind: "income",
			earned: false,
			amount: 300_000,
			frequency: "annual",
			start: "2027-04-30",
			growth: { bps: 100 },
		},
		{
			id: "living",
			kind: "expense",
			amount: 2_200_000,
			frequency: "monthly",
			start: "2026-01-01",
			growth: "inflation",
		},
		{
			id: "ssf-top-up",
			kind: "contribution",
			target: "ssf",
			amount: 1_500_000,
			frequency: "quarterly",
			start: "2026-03-31",
			end: "2035-12-31",
			growth: { bps: 0 },
		},
		{
			id: "loan-payment",
			kind: "contribution",
			target: "equipment-loan",
			amount: 350_000,
			frequency: "monthly",
			start: "2026-01-10",
			growth: { bps: 0 },
		},
	],
	cashflow: {
		contribute: ["ssf"],
		surplus: [{ account: "tax-reserve", upTo: 5_000_000 }, { account: "brokerage" }],
		withdraw: ["cash", "tax-reserve", "brokerage", "ssf"],
	},
}

const timeline: Timeline = { start: "2026-01-01", horizon: "2051-01-01", resolution: "day" }

export const freelancer: Fixture = { baseline, scenario, timeline }
