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
		{ id: "big", op: "const", value: 10_000_000 },
		{ id: "none", op: "const", value: 0 },
		// biome-ignore lint/suspicious/noThenProperty: `then` is a Measure operand key, not a thenable
		{ id: "middle", op: "pick", a: "salary", b: "low", then: "big", else: "none" },
		// biome-ignore lint/suspicious/noThenProperty: `then` is a Measure operand key, not a thenable
		{ id: "due", op: "pick", a: "salary", b: "high", then: "none", else: "middle" },
	],
	due: "due",
}

/**
 * A `pick` band charges 10,000,000 only while the tallied salary is between 900,000 and
 * 1,700,000: a mid-year stop pays it, a stop before July or after December does not.
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

/** Nothing lands on the first of the month; only the candidate's own month adds that buffer check. */
export const bufferDate: NamedCase = {
	fixture: makeFixture({
		accounts: [cash],
		balances: { cash: 200 },
		flows: [expense("living", 50, { frequency: "monthly", start: "2026-01-15" })],
		surplus: [{ account: "cash" }],
		withdraw: ["cash"],
		horizon: "2026-04-01",
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
