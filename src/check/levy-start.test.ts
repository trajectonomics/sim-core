import { describe, expect, it } from "bun:test"
import { expected } from "../testing"
import { checkWith, LEVY, levyProblems } from "./levy-fixture"

const at = ["timeline", "start"] as const

describe("check() Settlement period alignment", () => {
	it("accepts a Timeline start on the Levy's period month and day", () => {
		expect(checkWith({ levy: LEVY })).toEqual([])
		expect(checkWith({})).toEqual([])
	})

	it("rejects a start that is not a Settlement period start", () => {
		expect(checkWith({ levy: LEVY }, { start: "2026-01-02" })).toEqual(
			expected("START_NOT_PERIOD_START", at),
		)
	})

	it("accepts a different year when the month and day match", () => {
		expect(checkWith({ levy: LEVY }, { start: "2027-01-01" })).toEqual([])
	})

	it("checks the scenario Levy's own period rule", () => {
		const period = { month: 4, day: 30 }
		expect(levyProblems([["period"], period])).toEqual([])
		expect(checkWith({ levy: { ...(LEVY as object), period } })).toEqual(
			expected("START_NOT_PERIOD_START", at),
		)
	})

	it("does not add alignment noise when the period itself is invalid", () => {
		expect(levyProblems([["period"], { month: 2, day: 30 }])).toEqual(
			expected("INVALID_MONTH_DAY", ["scenario", "levy", "period"]),
		)
	})
})
