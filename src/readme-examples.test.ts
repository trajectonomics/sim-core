import { describe, expect, it } from "bun:test"
import { check } from "./check"
import { thaiEmployee } from "./fixtures/thai-employee"

/** The three snippets in the README's "Levies" section, verbatim. */
const salary = {
	id: "salary",
	kind: "income",
	earned: true,
	amount: 1_000_000,
	frequency: "monthly",
	start: "2026-01-31",
	growth: { bps: 0 },
	label: "salary",
	prepayments: [
		{ levy: "national", bps: 300 },
		{ levy: "local", bps: 200 },
	],
}

const stepped = {
	id: "due",
	op: "const",
	value: 100_000,
	steps: [
		{ from: "2026-06-01", value: 200_000 },
		{ from: "2027-01-01", value: 300_000 },
	],
}

const rent = {
	id: "rent",
	kind: "expense",
	frequency: "monthly",
	start: "2026-01-31",
	derive: {
		measures: [
			{ id: "salary", op: "flow", flow: "salary" },
			{ id: "result", op: "scale", of: "salary", num: 30, den: 100, rounding: "halfUp" },
		],
		result: "result",
	},
}

const carryIn = [{ periodStart: "2025-01-01", tallies: [], prepaid: 0 }]

const scenario = {
	schemaVersion: 4,
	currency: "THB",
	economy: { inflation: 0 },
	accounts: [{ id: "cash", kind: "asset", rate: 0 }],
	flows: [salary, rent],
	cashflow: { surplus: [{ account: "cash" }], contribute: [], withdraw: ["cash"] },
	levies: [
		{
			id: "national",
			period: { month: 1, day: 1 },
			settlement: { month: 3, day: 31 },
			measures: [stepped],
			due: "due",
			carryIn,
		},
		{
			id: "local",
			period: { month: 1, day: 1 },
			settlement: { month: 6, day: 30 },
			measures: [{ id: "due", op: "const", value: 0 }],
			due: "due",
			carryIn,
		},
	],
}

describe("README examples", () => {
	it("accepts the Levy, Dated constant and Derived amount snippets", () => {
		const baseline = { schemaVersion: 1, balances: [{ account: "cash", amount: 0 }] }
		const timeline = { start: "2026-01-01", horizon: "2027-12-31", resolution: "month" }
		expect(check(baseline, scenario, timeline)).toEqual([])
	})

	it("keeps the shared Thai employee fixture valid under schema v4", () => {
		const { baseline, scenario: base, timeline } = thaiEmployee
		expect(check(baseline, base, timeline)).toEqual([])
	})
})
