import { describe, expect, it } from "bun:test"
import { check } from "../check"
import { thaiEmployee } from "../fixtures/thai-employee"
import { expected, problemsFor, REMOVE } from "../testing"

const { baseline, scenario, timeline } = thaiEmployee

describe("check() structure", () => {
	it.each([
		["undefined", undefined],
		["null", null],
		["a number", 0],
		["a string", "x"],
		["a boolean", true],
		["an array", []],
		["a nested array", [[]]],
		["a function", () => 1],
		["a symbol", Symbol("s")],
		["a bigint", 1n],
	])("flags %s as NOT_AN_OBJECT without throwing", (_name, g) => {
		expect(() => check(g, g, g)).not.toThrow()
		expect(check(g, g, g).map((p) => p.code)).toContain("NOT_AN_OBJECT")
	})

	it("never throws on wrongly typed nested values", () => {
		const cashflow = { surplus: [7], withdraw: 3 }
		const bad = { ...scenario, accounts: [null, 1, "a"], flows: {}, cashflow }
		expect(() => check(baseline, bad, timeline)).not.toThrow()
		expect(() => check({ schemaVersion: 1, balances: [null, {}] }, bad, timeline)).not.toThrow()
	})

	it("reports a single UNSUPPORTED_SCHEMA_VERSION instead of unknown-key noise", () => {
		const v2 = { schemaVersion: 2, whatever: 1, balances: [] }
		expect(check(v2, scenario, timeline)).toEqual(
			expected("UNSUPPORTED_SCHEMA_VERSION", ["baseline", "schemaVersion"]),
		)
	})

	it("rejects a scenario schemaVersion other than 3", () => {
		expect(problemsFor({ scenario: [["schemaVersion"], 1] })).toEqual(
			expected("UNSUPPORTED_SCHEMA_VERSION", ["scenario", "schemaVersion"]),
		)
	})

	it("accepts baseline schemaVersion 1 with scenario schemaVersion 3", () => {
		expect(problemsFor({})).toEqual([])
	})

	it("skips baseline account lookups when the scenario version is unsupported", () => {
		const problems = problemsFor({
			scenario: [["schemaVersion"], 1],
			baseline: [["balances", 0, "account"], "not-declared"],
		})
		expect(problems).toEqual(expected("UNSUPPORTED_SCHEMA_VERSION", ["scenario", "schemaVersion"]))
	})

	it("rejects a missing schemaVersion", () => {
		expect(problemsFor({ baseline: [["schemaVersion"], REMOVE] })).toEqual(
			expected("UNSUPPORTED_SCHEMA_VERSION", ["baseline", "schemaVersion"]),
		)
	})

	it("reports problems from all three inputs in one pass", () => {
		const codes = problemsFor({
			baseline: [["balances", 0, "amount"], -1],
			scenario: [["currency"], 5],
			timeline: [["resolution"], "week"],
		}).map((p) => p.code)
		expect(codes).toEqual(["NEGATIVE_AMOUNT", "WRONG_TYPE", "INVALID_RESOLUTION"])
	})

	it.each([
		["the scenario", []],
		["economy", ["economy"]],
		["an account", ["accounts", 0]],
		["a flow", ["flows", 0]],
		["a growth object", ["flows", 0, "growth"]],
		["cashflow", ["cashflow"]],
		["a surplus step", ["cashflow", "surplus", 0]],
	])("rejects an unknown key on %s", (_name, parent) => {
		const path = [...parent, "extra"]
		expect(problemsFor({ scenario: [path, 1] })).toEqual(
			expected("UNKNOWN_KEY", ["scenario", ...path]),
		)
	})

	it("rejects an unknown key on the baseline", () => {
		expect(problemsFor({ baseline: [["extra"], 1] })).toEqual(
			expected("UNKNOWN_KEY", ["baseline", "extra"]),
		)
	})

	it("rejects an unknown key on a balance", () => {
		expect(problemsFor({ baseline: [["balances", 0, "extra"], 1] })).toEqual(
			expected("UNKNOWN_KEY", ["baseline", "balances", 0, "extra"]),
		)
	})

	it("rejects an unknown key on the timeline", () => {
		expect(problemsFor({ timeline: [["extra"], 1] })).toEqual(
			expected("UNKNOWN_KEY", ["timeline", "extra"]),
		)
	})

	it("rejects a typo'd key and reports the missing one", () => {
		const codes = problemsFor({ scenario: [["economy"], { inflaton: 1 }] }).map((p) => p.code)
		expect(codes).toEqual(["UNKNOWN_KEY", "MISSING_KEY"])
	})

	it("rejects a non-array flows", () => {
		expect(problemsFor({ scenario: [["flows"], {}] })).toEqual(
			expected("NOT_AN_ARRAY", ["scenario", "flows"]),
		)
	})

	it("rejects a non-array balances", () => {
		expect(problemsFor({ baseline: [["balances"], {}] })).toEqual(
			expected("NOT_AN_ARRAY", ["baseline", "balances"]),
		)
	})

	it("rejects a non-array withdraw", () => {
		expect(problemsFor({ scenario: [["cashflow", "withdraw"], "cash"] })).toEqual(
			expected("NOT_AN_ARRAY", ["scenario", "cashflow", "withdraw"]),
		)
	})

	it("rejects an empty currency", () => {
		expect(problemsFor({ scenario: [["currency"], ""] })).toEqual(
			expected("EMPTY_STRING", ["scenario", "currency"]),
		)
	})
})
