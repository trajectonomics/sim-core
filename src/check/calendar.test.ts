import { describe, expect, it } from "bun:test"
import { addDays } from "../calendar/arith"
import { expected, problemsFor } from "../testing"
import type { Problem } from "./codes"

const calendarPath = ["scenario", "calendar"] as const
const holidaysPath = [...calendarPath, "holidays"] as const

/** The problems the Thai-employee fixture reports after its Calendar is replaced with `value`. */
function calendarProblems(value: unknown): readonly Problem[] {
	return problemsFor({ scenario: [["calendar"], value] })
}

/**
 * Every date from `start` through `days` days later, inclusive. `2026-01-05` is a Monday, so a span
 * starting that day is also closed on the Sunday before it, and a Tuesday start is not.
 */
function closedSpan(start: string, days: number): readonly string[] {
	const dates: string[] = []
	for (let index = 0; index < days; index++) dates.push(addDays(start, index))
	return dates
}

describe("check() accepts a usable Calendar", () => {
	it("takes a next Calendar with no Holidays and one with unsorted Holidays", () => {
		expect(calendarProblems({ dayRule: "next", holidays: [] })).toEqual([])
		expect(calendarProblems({ dayRule: "next", holidays: ["2026-12-25", "2026-01-01"] })).toEqual(
			[],
		)
	})

	it("takes exact with a non-empty Holiday list, and dates outside the Timeline", () => {
		expect(calendarProblems({ dayRule: "exact", holidays: ["1990-06-04", "2041-01-01"] })).toEqual(
			[],
		)
	})

	it("takes a closure of 365 days and rejects 366", () => {
		expect(calendarProblems({ dayRule: "next", holidays: closedSpan("2026-01-06", 365) })).toEqual(
			[],
		)
		expect(calendarProblems({ dayRule: "next", holidays: closedSpan("2026-01-06", 366) })).toEqual(
			expected("HOLIDAYS_UNUSABLE", holidaysPath),
		)
	})

	it("counts the weekend days that touch the first and last Holiday", () => {
		// 365 listed days from a Monday close 367: the Saturday and Sunday before them are closed too.
		expect(calendarProblems({ dayRule: "next", holidays: closedSpan("2026-01-05", 365) })).toEqual(
			expected("HOLIDAYS_UNUSABLE", holidaysPath),
		)
	})

	it("closes a run that only a weekend bridges between two Holiday blocks", () => {
		const block = closedSpan("2026-01-05", 181)
		const bridged = [...block, ...closedSpan("2026-07-06", 182)]
		expect(calendarProblems({ dayRule: "next", holidays: bridged })).toEqual(
			expected("HOLIDAYS_UNUSABLE", holidaysPath),
		)
		const separated = [...block, ...closedSpan("2026-07-07", 182)]
		expect(calendarProblems({ dayRule: "next", holidays: separated })).toEqual([])
	})
})

describe("check() Calendar codes", () => {
	it("rejects a day rule outside exact and next", () => {
		expect(calendarProblems({ dayRule: "previous", holidays: [] })).toEqual(
			expected("INVALID_DAY_RULE", [...calendarPath, "dayRule"]),
		)
	})

	it("rejects a repeated Holiday at the repeated index", () => {
		expect(calendarProblems({ dayRule: "next", holidays: ["2026-07-01", "2026-07-01"] })).toEqual(
			expected("DUPLICATE_HOLIDAY", [...holidaysPath, 1]),
		)
	})

	it("rejects structural damage with the existing codes and paths", () => {
		expect(calendarProblems(7)).toEqual(expected("NOT_AN_OBJECT", calendarPath))
		expect(calendarProblems({ dayRule: "next", holidays: [], weekend: "fri-sat" })).toEqual(
			expected("UNKNOWN_KEY", [...calendarPath, "weekend"]),
		)
		expect(calendarProblems({ holidays: [] })).toEqual(
			expected("MISSING_KEY", [...calendarPath, "dayRule"]),
		)
		expect(calendarProblems({ dayRule: "next" })).toEqual(expected("MISSING_KEY", holidaysPath))
		expect(calendarProblems({ dayRule: "next", holidays: "2026-01-01" })).toEqual(
			expected("NOT_AN_ARRAY", holidaysPath),
		)
		expect(calendarProblems({ dayRule: "next", holidays: ["2026-02-30"] })).toEqual(
			expected("INVALID_DATE", [...holidaysPath, 0]),
		)
	})

	it("reports every problem in one pass", () => {
		expect(
			calendarProblems({
				dayRule: "nearest",
				holidays: ["2026-07-01", "2026-07-01", "2026-02-30"],
			}),
		).toEqual([
			{ code: "INVALID_DAY_RULE", path: [...calendarPath, "dayRule"] },
			{ code: "INVALID_DATE", path: [...holidaysPath, 2] },
			{ code: "DUPLICATE_HOLIDAY", path: [...holidaysPath, 1] },
		])
	})
})
