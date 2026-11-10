import { emptyCarryIn } from "../engine/test-helpers"
import type { Fixture } from "../fixtures/fixture"
import { brokerage, cash, deposit, living, salary, timeline } from "./levy-source-flows"

/** One Account taxed on the gains of its withdrawals beside one taxed on returns. */
export const levyGainsDay: Fixture = {
	baseline: {
		schemaVersion: 1,
		balances: [
			{ account: "brokerage", amount: 100_000, basis: 80_000 },
			{ account: "cash", amount: 1_000_000 },
			{ account: "deposit", amount: 100_000 },
		],
	},
	scenario: {
		schemaVersion: 4,
		currency: "THB",
		economy: { inflation: 250 },
		accounts: [brokerage, cash, deposit],
		flows: [salary, living],
		cashflow: {
			surplus: [{ account: "cash" }],
			contribute: [],
			withdraw: ["cash", "deposit", "brokerage"],
		},
		levies: [
			{
				id: "gains",
				period: { month: 1, day: 1 },
				settlement: { month: 6, day: 30 },
				measures: [
					{ id: "gain", op: "tally", label: "gain", basis: "gains" },
					{ id: "interest", op: "tally", label: "interest", basis: "returns" },
					{ id: "zero", op: "const", value: 0 },
					{ id: "due", op: "max", a: "gain", b: "zero" },
				],
				due: "due",
				carryIn: [emptyCarryIn("2025-01-01")],
			},
		],
	},
	timeline,
}
