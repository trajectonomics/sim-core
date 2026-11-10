import type { Returns } from "../engine/returns"
import type { Fixture } from "../fixtures/fixture"

/** One Account at 100,000 on 2023-01-01, two rows of 180 and 185 counted days, 1,000 then 800 bps. */
export const handRows: Fixture = {
	baseline: { schemaVersion: 1, balances: [{ account: "cash", amount: 100000 }] },
	scenario: {
		schemaVersion: 4,
		currency: "THB",
		economy: { inflation: 0 },
		accounts: [{ id: "cash", kind: "asset", rate: 5000 }],
		flows: [],
		cashflow: { surplus: [{ account: "cash" }], contribute: [], withdraw: ["cash"] },
	},
	timeline: { start: "2023-01-01", horizon: "2024-01-01", resolution: "day" },
}

export const handRowsReturns: Returns = {
	returnsVersion: 1,
	series: [
		{
			account: "cash",
			rows: [
				{ from: "2023-01-01", returnBps: 1000 },
				{ from: "2023-06-30", returnBps: 800 },
			],
		},
	],
}
