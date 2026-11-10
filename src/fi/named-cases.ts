/** TEST-ONLY fixtures behind the named non-monotonicity tests; not imported by `src/index.ts`. */
import { expense, income } from "../engine/test-flows"
import { makeFixture } from "../engine/test-helpers"
import type { Fixture } from "../fixtures/fixture"
import type { Levy, SurvivalOptions } from "../types"

export interface NamedCase {
	readonly fixture: Fixture
	readonly options: SurvivalOptions
}

const cash = { id: "cash", kind: "asset", rate: 0 } as const

/**
 * Stopping in June removes the big expense from the walk (retirement spending replaces it), so a
 * June candidate is richer than a July one that paid it in the prefix and then ran out.
 */
export const retirementGap: NamedCase = {
	fixture: makeFixture({
		accounts: [cash],
		balances: { cash: 6_000_000 },
		flows: [
			income("pay", 300_000, { frequency: "monthly", start: "2026-01-10" }),
			expense("big", 7_000_000, { start: "2026-06-01" }),
		],
		surplus: [{ account: "cash" }],
		withdraw: ["cash"],
		horizon: "2027-12-01",
	}),
	options: { method: "survival", retirementSpending: { amount: 100_000, growth: { bps: 0 } } },
}

const bandLevy: Levy = {
	id: "band",
	period: { month: 1, day: 1 },
	settlement: { month: 6, day: 30 },
	measures: [
		{ id: "salary", op: "tally", label: "salary", basis: "gross" },
		{ id: "low", op: "const", value: 900_000 },
		{ id: "high", op: "const", value: 1_700_000 },
		{ id: "base", op: "const", value: 3_000_000 },
		{ id: "none", op: "const", value: 0 },
		{ id: "middle", op: "sub", a: "base", b: "salary" },
		// biome-ignore lint/suspicious/noThenProperty: `then` is a Measure operand key, not a thenable
		{ id: "inner", op: "pick", a: "salary", b: "low", then: "middle", else: "none" },
		// biome-ignore lint/suspicious/noThenProperty: `then` is a Measure operand key, not a thenable
		{ id: "due", op: "pick", a: "salary", b: "high", then: "none", else: "inner" },
	],
	due: "due",
}

/**
 * A `sub` inside a `pick` band charges `3,000,000 - tally` only while the tallied salary is
 * between 900,000 and 1,700,000: a stop from August to October pays it, one before August or after
 * October does not.
 */
export const levyBand: NamedCase = {
	fixture: makeFixture({
		accounts: [cash],
		balances: { cash: 300_000 },
		flows: [
			income("pay", 150_000, { frequency: "monthly", start: "2026-01-10", label: "salary" }),
			expense("living", 10_000, { frequency: "monthly", start: "2026-01-15" }),
		],
		surplus: [{ account: "cash" }],
		withdraw: ["cash"],
		horizon: "2027-09-01",
		levy: bandLevy,
	}),
	options: { method: "survival" },
}

/**
 * The one-off expense on 2027-01-20 raises `required(D)` from 2026-01-21, so February's own
 * month is checked at 660 before the gift lands, while January never checks a date in that
 * window and the gift makes the balance comfortable again before March.
 */
export const bufferDate: NamedCase = {
	fixture: makeFixture({
		accounts: [cash],
		balances: { cash: 300 },
		flows: [
			expense("living", 10, { frequency: "monthly", start: "2026-01-15" }),
			expense("one-off", 1_200, { start: "2027-01-20" }),
			{ ...income("gift", 3_000, { start: "2026-02-10" }), earned: false },
		],
		surplus: [{ account: "cash" }],
		withdraw: ["cash"],
		horizon: "2027-06-01",
	}),
	options: { method: "survival", minBufferMonths: 6 },
}

/**
 * The surplus hits the cap and the fill is skipped, so the account is not committed that month:
 * a later withdrawal values it from an older commit date and rounds at a different one.
 */
export const upToCap: NamedCase = {
	fixture: makeFixture({
		accounts: [
			{ id: "capped", kind: "asset", rate: 7_000 },
			{ id: "spill", kind: "asset", rate: 0 },
		],
		balances: { capped: 0, spill: 0 },
		flows: [income("pay", 100_000, { frequency: "monthly", start: "2026-01-10" })],
		surplus: [{ account: "capped", upTo: 100_000 }, { account: "spill" }],
		withdraw: ["spill", "capped"],
		horizon: "2028-01-01",
	}),
	options: { method: "survival" },
}
