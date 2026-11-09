import { describe, expect, it } from "bun:test"
import type { Frequency } from "../types"
import { occurrences } from "./occurrence"

/** The window, with no Calendar: these cases pin today's behaviour. */
const withoutCalendar = (
	start: string,
	frequency: Frequency,
	end: string | undefined,
	from: string,
	to: string,
) => occurrences(start, frequency, end, from, to, undefined)

const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const STEPS: Readonly<Record<string, readonly [string, number]>> = {
	daily: ["day", 1],
	weekly: ["day", 7],
	biweekly: ["day", 14],
	monthly: ["month", 1],
	quarterly: ["month", 3],
	annual: ["month", 12],
}

function leap(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function monthDays(year: number, month: number): number {
	return month === 2 && leap(year) ? 29 : (DAYS[month - 1] ?? 0)
}

function parse(value: string): [number, number, number] {
	return value.split("-").map(Number) as [number, number, number]
}

function format(year: number, month: number, day: number): string {
	return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function nextDay(value: string): string {
	let [year, month, day] = parse(value)
	day++
	if (day > monthDays(year, month)) {
		day = 1
		month++
	}
	if (month > 12) {
		month = 1
		year++
	}
	return format(year, month, day)
}

function clampAdd(start: string, months: number): string {
	const [sy, sm, sd] = parse(start)
	const total = sy * 12 + (sm - 1) + months
	const year = Math.floor(total / 12)
	const month = (total % 12) + 1
	return format(year, month, Math.min(sd, monthDays(year, month)))
}

function monthDistance(from: string, to: string): number {
	const [fy, fm] = parse(from)
	const [ty, tm] = parse(to)
	return (ty - fy) * 12 + (tm - fm)
}

function matches(
	start: string,
	date: string,
	frequency: Frequency,
	serial: number,
	startDay: number,
): boolean {
	if (frequency === "once") return date === start
	const step = STEPS[frequency] ?? ["day", 1]
	if (step[0] === "day") return serial % step[1] === 0
	const [year, month, day] = parse(date)
	return (
		monthDistance(start, date) % step[1] === 0 && day === Math.min(startDay, monthDays(year, month))
	)
}

/** Enumerates every date and applies the spec directly, independently of `occurrences`. */
function bruteForce(
	start: string,
	frequency: Frequency,
	end: string | undefined,
	from: string,
	to: string,
): string[] {
	const dates: string[] = []
	const last = end !== undefined && end < to ? end : to
	const startDay = parse(start)[2]
	let serial = 0
	for (let date = start; date <= last; date = nextDay(date)) {
		if (date >= from && matches(start, date, frequency, serial, startDay)) dates.push(date)
		serial++
	}
	return dates
}

describe("occurrences", () => {
	const frequencies: readonly Frequency[] = [
		"once",
		"daily",
		"weekly",
		"biweekly",
		"monthly",
		"quarterly",
		"annual",
	]
	const starts = ["2023-01-31", "2024-02-29", "2024-11-30"]

	it("matches a brute-force scan of every date", () => {
		for (const frequency of frequencies) {
			for (const start of starts) {
				const end = frequency === "once" ? start : "2026-06-30"
				const got = withoutCalendar(start, frequency, end, "2024-01-15", "2026-05-31")
				expect(got.map((item) => item.date)).toEqual(
					bruteForce(start, frequency, end, "2024-01-15", "2026-05-31"),
				)
			}
		}
	})

	it("matches a brute-force growth-anniversary count", () => {
		const got = withoutCalendar("2024-02-29", "monthly", undefined, "2024-01-01", "2029-01-01")
		for (const item of got) {
			let years = 0
			while (clampAdd("2024-02-29", (years + 1) * 12) <= item.date) years++
			expect(item.years).toBe(years)
		}
	})
})

describe("occurrence edge cases", () => {
	it("clamps a day-31 monthly flow in leap and non-leap Februaries", () => {
		expect(withoutCalendar("2024-01-31", "monthly", undefined, "2024-01-01", "2024-04-30")).toEqual(
			[
				{ date: "2024-01-31", years: 0 },
				{ date: "2024-02-29", years: 0 },
				{ date: "2024-03-31", years: 0 },
				{ date: "2024-04-30", years: 0 },
			],
		)
		const nonLeap = withoutCalendar("2023-01-31", "monthly", undefined, "2023-01-01", "2023-03-31")
		expect(nonLeap.map((item) => item.date)).toEqual(["2023-01-31", "2023-02-28", "2023-03-31"])
	})

	it("keeps a Feb 29 annual flow clamped and counts growth years", () => {
		const got = withoutCalendar("2024-02-29", "annual", undefined, "2024-01-01", "2029-01-01")
		expect(got).toEqual([
			{ date: "2024-02-29", years: 0 },
			{ date: "2025-02-28", years: 1 },
			{ date: "2026-02-28", years: 2 },
			{ date: "2027-02-28", years: 3 },
			{ date: "2028-02-29", years: 4 },
		])
	})

	it("skips occurrences before the timeline and ignores a once flow before it", () => {
		expect(
			withoutCalendar("2025-01-31", "monthly", undefined, "2025-03-15", "2025-04-30").map(
				(item) => item.date,
			),
		).toEqual(["2025-03-31", "2025-04-30"])
		expect(withoutCalendar("2024-12-31", "once", undefined, "2025-01-01", "2025-12-31")).toEqual([])
	})

	it("includes both start and horizon, and treats end inclusively", () => {
		expect(withoutCalendar("2026-01-01", "once", undefined, "2026-01-01", "2026-01-01")).toEqual([
			{ date: "2026-01-01", years: 0 },
		])
		const weekly = withoutCalendar("2026-01-01", "weekly", "2026-01-15", "2026-01-01", "2027-01-01")
		expect(weekly.map((item) => item.date)).toEqual(["2026-01-01", "2026-01-08", "2026-01-15"])
	})
})
