import { describe, expect, it } from "bun:test"
import { check } from "../check"
import { edit, expected, REMOVE } from "../testing"
import type { Baseline, Scenario, Timeline } from "../types"
import { LEVY } from "./levy-fixture"

const baseline: Baseline = {
	schemaVersion: 1,
	balances: [
		{ account: "cash", amount: 100 },
		{ account: "deposit", amount: 100 },
	],
}

const scenario: Scenario = {
	schemaVersion: 4,
	currency: "THB",
	economy: { inflation: 0 },
	accounts: [
		{ id: "cash", kind: "asset", rate: 0 },
		{ id: "deposit", kind: "asset", rate: 500 },
		{ id: "loan", kind: "liability", rate: 100 },
	],
	flows: [],
	cashflow: { surplus: [{ account: "cash" }], contribute: [], withdraw: ["cash"] },
	levies: [LEVY as never],
}

const timeline: Timeline = { start: "2026-01-01", horizon: "2026-12-31", resolution: "day" }

function withAccount(index: number, patch: Readonly<Record<string, unknown>>): Scenario {
	const accounts = scenario.accounts.map((account, i) =>
		i === index ? { ...account, ...patch } : account,
	)
	return { ...scenario, accounts }
}

function withBalance(index: number, patch: Readonly<Record<string, unknown>>): Baseline {
	const balances = baseline.balances.map((balance, i) =>
		i === index ? { ...balance, ...patch } : balance,
	)
	return { ...baseline, balances }
}

describe("check() Account tally labels", () => {
	it("accepts a returnLabel and a gainLabel on an asset Account", () => {
		expect(check(baseline, withAccount(0, { returnLabel: "interest" }), timeline)).toEqual([])
		const gained = withBalance(1, { basis: 100 })
		expect(check(gained, withAccount(1, { gainLabel: "gain" }), timeline)).toEqual([])
	})

	it("accepts a basis on an Account without a gainLabel and ignores it", () => {
		expect(check(withBalance(0, { basis: 50 }), scenario, timeline)).toEqual([])
	})

	it("rejects a label on a liability Account", () => {
		expect(check(baseline, withAccount(2, { gainLabel: "gain" }), timeline)).toEqual(
			expected("LIABILITY_MISUSE", ["scenario", "accounts", 2, "gainLabel"]),
		)
	})

	it("rejects both labels on one Account", () => {
		const both = withAccount(0, { returnLabel: "interest", gainLabel: "gain" })
		expect(check(withBalance(0, { basis: 100 }), both, timeline)).toEqual(
			expected("CONFLICTING_LABELS", ["scenario", "accounts", 0, "gainLabel"]),
		)
	})

	it("requires a Levy for a label and still rejects an unknown key", () => {
		const { levies: _ignored, ...withoutLevy } = scenario
		expect(
			check(
				baseline,
				{ ...withoutLevy, accounts: withAccount(0, { returnLabel: "interest" }).accounts },
				timeline,
			),
		).toEqual(expected("LEVY_REQUIRED", ["scenario", "accounts", 0, "returnLabel"]))
		const unknown = edit(scenario, [["accounts", 0, "yieldLabel"], "interest"])
		expect(check(baseline, unknown as Scenario, timeline)).toEqual(
			expected("UNKNOWN_KEY", ["scenario", "accounts", 0, "yieldLabel"]),
		)
	})

	it("requires an opening basis for a positive balance on a gain-tracked Account", () => {
		expect(check(baseline, withAccount(1, { gainLabel: "gain" }), timeline)).toEqual(
			expected("MISSING_BASIS", ["baseline", "balances", 1, "basis"]),
		)
		const noBalance = { ...baseline, balances: [{ account: "cash", amount: 100 }] }
		expect(check(noBalance, withAccount(1, { gainLabel: "gain" }), timeline)).toEqual([])
	})

	it("accepts a zero balance without a basis and rejects a negative basis", () => {
		const zero = withBalance(1, { amount: 0 })
		expect(check(zero, withAccount(1, { gainLabel: "gain" }), timeline)).toEqual([])
		expect(
			check(withBalance(1, { basis: -1 }), withAccount(1, { gainLabel: "gain" }), timeline),
		).toEqual(expected("NEGATIVE_AMOUNT", ["baseline", "balances", 1, "basis"]))
	})

	it("rejects a removed basis as missing, not as zero", () => {
		const removed = edit(withBalance(1, { basis: 100 }), [["balances", 1, "basis"], REMOVE])
		expect(check(removed as Baseline, withAccount(1, { gainLabel: "gain" }), timeline)).toEqual(
			expected("MISSING_BASIS", ["baseline", "balances", 1, "basis"]),
		)
	})
})
