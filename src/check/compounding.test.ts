import { describe, expect, it } from "bun:test"
import { check } from "../check"
import type { Problem } from "../check/codes"
import { thaiEmployee } from "../fixtures/thai-employee"

const base = thaiEmployee.scenario.accounts[0]!
const rest = thaiEmployee.scenario.accounts.slice(1)

/** The Thai employee Scenario with its first Account replaced by `account`. */
function problemsForAccount(account: Readonly<Record<string, unknown>>): readonly Problem[] {
	const scenario = { ...thaiEmployee.scenario, accounts: [account, ...rest] }
	return check(thaiEmployee.baseline, scenario, thaiEmployee.timeline)
}

function problemsWith(rate: number, compounding?: string): readonly Problem[] {
	return problemsForAccount({
		...base,
		rate,
		...(compounding === undefined ? {} : { compounding }),
	})
}

const ratePath = ["scenario", "accounts", 0, "rate"]
const compoundingPath = ["scenario", "accounts", 0, "compounding"]

describe("check() compounding vocabulary", () => {
	it("accepts every compounding period in the closed set", () => {
		for (const compounding of ["monthly", "quarterly", "semiannual", "annual"]) {
			expect(problemsWith(50, compounding)).toEqual([])
		}
	})

	it("rejects a compounding period outside the closed set", () => {
		expect(problemsWith(50, "daily")).toEqual([
			{ code: "INVALID_COMPOUNDING", path: compoundingPath },
		])
	})

	it("rejects a misspelled compounding key as an unknown key", () => {
		const problems = problemsForAccount({ ...base, compouding: "monthly" })
		expect(problems).toEqual([
			{ code: "UNKNOWN_KEY", path: ["scenario", "accounts", 0, "compouding"] },
		])
	})

	it("accepts a zero nominal rate", () => {
		expect(problemsWith(0, "monthly")).toEqual([])
	})

	it("rejects a negative nominal rate once, at the rate path", () => {
		expect(problemsWith(-1, "monthly")).toEqual([{ code: "RATE_OUT_OF_RANGE", path: ratePath }])
	})

	it("keeps the effective annual floor for an Account without compounding", () => {
		expect(problemsWith(-9999)).toEqual([])
		expect(problemsWith(-10000)).toEqual([{ code: "RATE_OUT_OF_RANGE", path: ratePath }])
	})

	it("reports one INVALID_COMPOUNDING for an invalid period even with a negative rate", () => {
		expect(problemsWith(-1, "daily")).toEqual([
			{ code: "INVALID_COMPOUNDING", path: compoundingPath },
		])
	})

	it("reports a below-floor rate once when compounding is invalid", () => {
		expect(problemsWith(-12000, "daily")).toEqual([
			{ code: "INVALID_COMPOUNDING", path: compoundingPath },
			{ code: "RATE_OUT_OF_RANGE", path: ratePath },
		])
	})

	it("requires scenario schemaVersion 4", () => {
		const version = (value: number): readonly Problem[] =>
			check(
				thaiEmployee.baseline,
				{ ...thaiEmployee.scenario, schemaVersion: value },
				thaiEmployee.timeline,
			)
		expect(version(2)).toEqual([
			{ code: "UNSUPPORTED_SCHEMA_VERSION", path: ["scenario", "schemaVersion"] },
		])
		expect(version(4)).toEqual([])
	})
})
