import { emptyCarryIn } from "../engine/test-helpers"
import type { Fixture } from "../fixtures/fixture"
import { cash, deposit, living, pension, salary, timeline } from "./levy-source-flows"

/** One Account taxed on its accrued returns; a locked Account is left unlabelled. */
export const levyReturnsDay: Fixture = {
	baseline: {
		schemaVersion: 1,
		balances: [
			{ account: "cash", amount: 1_000_000 },
			{ account: "deposit", amount: 100_000 },
			{ account: "pension", amount: 50_000 },
		],
	},
	scenario: {
		schemaVersion: 2,
		currency: "THB",
		economy: { inflation: 250 },
		accounts: [cash, deposit, pension],
		flows: [salary, living],
		cashflow: { surplus: [{ account: "cash" }], contribute: [], withdraw: ["cash", "deposit"] },
		levy: {
			id: "returns",
			period: { month: 1, day: 1 },
			settlement: { month: 6, day: 30 },
			measures: [{ id: "interest", op: "tally", label: "interest", basis: "returns" }],
			due: "interest",
			carryIn: [emptyCarryIn("2025-01-01")],
		},
	},
	timeline,
}
