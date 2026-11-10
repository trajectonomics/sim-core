import { describe, expect, it } from "bun:test"
import { compoundingDate, periodCountedDays, periodStart, periodsPerYear } from "./compounding"

describe("compounding periods", () => {
	it("aligns periods to the calendar, independent of the start", () => {
		expect(periodStart("2026-02-17", "monthly")).toBe("2026-02-01")
		expect(compoundingDate("2026-02-17", "monthly")).toBe("2026-02-28")
		expect(periodStart("2026-02-17", "quarterly")).toBe("2026-01-01")
		expect(compoundingDate("2026-02-17", "quarterly")).toBe("2026-03-31")
		expect(periodStart("2026-02-17", "semiannual")).toBe("2026-01-01")
		expect(compoundingDate("2026-02-17", "semiannual")).toBe("2026-06-30")
		expect(periodStart("2026-02-17", "annual")).toBe("2026-01-01")
		expect(compoundingDate("2026-02-17", "annual")).toBe("2026-12-31")
	})

	it("closes a quarter, half-year and year at the end of the year", () => {
		expect(compoundingDate("2026-11-30", "quarterly")).toBe("2026-12-31")
		expect(compoundingDate("2026-11-30", "semiannual")).toBe("2026-12-31")
		expect(compoundingDate("2026-11-30", "annual")).toBe("2026-12-31")
	})

	it("reports the periods per year", () => {
		expect(periodsPerYear("monthly")).toBe(12)
		expect(periodsPerYear("quarterly")).toBe(4)
		expect(periodsPerYear("semiannual")).toBe(2)
		expect(periodsPerYear("annual")).toBe(1)
	})

	it("counts a period's days with Actual/365 No Leap", () => {
		expect(periodCountedDays("2026-01-16", "monthly")).toBe(31)
		expect(periodCountedDays("2024-02-10", "monthly")).toBe(28)
		expect(periodCountedDays("2026-02-10", "monthly")).toBe(28)
		expect(periodCountedDays("2026-05-10", "quarterly")).toBe(91)
		expect(periodCountedDays("2026-08-10", "semiannual")).toBe(184)
		expect(periodCountedDays("2024-02-10", "quarterly")).toBe(90)
		expect(periodCountedDays("2026-08-10", "annual")).toBe(365)
		expect(periodCountedDays("2024-08-10", "annual")).toBe(365)
	})

	it("counts the first annual period from 0001-01-01 without a previous date", () => {
		expect(periodStart("0001-01-01", "annual")).toBe("0001-01-01")
		expect(compoundingDate("0001-06-01", "annual")).toBe("0001-12-31")
		expect(periodCountedDays("0001-06-01", "annual")).toBe(365)
	})

	it("stays inside the supported calendar at the last year", () => {
		expect(compoundingDate("9998-12-01", "annual")).toBe("9998-12-31")
		expect(compoundingDate("9999-12-31", "monthly")).toBe("9999-12-31")
		expect(periodCountedDays("9999-12-31", "monthly")).toBe(31)
		expect(periodCountedDays("9999-06-01", "annual")).toBe(365)
	})
})
