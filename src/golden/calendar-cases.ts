import { expense, income } from "../engine/test-flows"
import type { Fixture } from "../fixtures/fixture"

/**
 * A Calendar that shifts both ways: a salary anchored on the 31st and a bill on the 1st, with
 * Holidays that chain across a weekend. 2026-01-31 is a Saturday, so January's salary lands on
 * Monday 2026-02-02; 2026-12-25 and 2027-01-01 close a long weekend.
 */
const scenario: Fixture["scenario"] = {
	schemaVersion: 4,
	currency: "THB",
	economy: { inflation: 200 },
	accounts: [{ id: "cash", kind: "asset", rate: 0 }],
	flows: [
		income("salary", 1_000_000, { frequency: "monthly", start: "2026-01-31" }),
		expense("living", 400_000, { frequency: "monthly", start: "2026-01-01", growth: "inflation" }),
	],
	cashflow: { surplus: [{ account: "cash" }], contribute: [], withdraw: ["cash"] },
	calendar: { dayRule: "next", holidays: ["2026-04-06", "2026-12-25", "2027-01-01"] },
}

const baseline: Fixture["baseline"] = {
	schemaVersion: 1,
	balances: [{ account: "cash", amount: 30_000_000 }],
}

/** Two years of shifted money at day resolution. */
export const calendarShiftDay: Fixture = {
	baseline,
	scenario,
	timeline: { start: "2026-01-01", horizon: "2028-03-31", resolution: "day" },
}

/** The same money over a horizon long enough for the survival scan to reach a month. */
export const calendarFiMonth: Fixture = {
	baseline,
	scenario,
	timeline: { start: "2026-01-01", horizon: "2040-01-01", resolution: "month" },
}
