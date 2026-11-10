import { describe, expect, it } from "bun:test"
import type { CompoundingPeriod } from "../types"
import { type Accrual, accrualParts, capitaliseThrough, commitThrough } from "./nominal"

const at = (principal: number, date: string): Accrual => ({
	principal: BigInt(principal),
	principalDays: 0n,
	asOf: date,
})

const monthly = { rate: 1200, compounding: "monthly" } as const

describe("nominal capitalisation", () => {
	it("earns exactly one twelfth of the nominal rate in a full month", () => {
		const settled = capitaliseThrough(at(1_200_000, "2025-12-31"), monthly, "2026-01-31")
		expect(settled).toEqual(at(1_212_000, "2026-01-31"))
	})

	it("pro-rates a partial first month by its counted days", () => {
		const settled = capitaliseThrough(at(1_200_000, "2026-01-16"), monthly, "2026-01-31")
		expect(settled).toEqual(at(1_205_806, "2026-01-31"))
	})

	it("rounds a half-unit capitalisation up", () => {
		const settled = capitaliseThrough(at(50, "2025-12-31"), monthly, "2026-01-31")
		expect(settled.principal).toBe(51n)
	})

	it("does not grow a ten-satang balance at four percent monthly", () => {
		const settled = capitaliseThrough(
			at(10, "2025-12-31"),
			{ rate: 400, compounding: "monthly" },
			"2026-12-31",
		)
		expect(settled.principal).toBe(10n)
	})

	it("capitalises each calendar period in a long gap", () => {
		const settled = capitaliseThrough(at(1_000_000, "2025-12-31"), monthly, "2026-12-31")
		let oracle = 1_000_000n
		for (let month = 0; month < 12; month++) {
			oracle += (oracle * 1200n + 60_000n) / 120_000n
		}
		expect(settled.principal).toBe(oracle)
		expect(settled.principalDays).toBe(0n)
		expect(settled.asOf).toBe("2026-12-31")
	})

	it("earns a quarter, half-year and year as one period each", () => {
		const cases = [
			[800, "quarterly", "2026-03-31", 1_020_000],
			[600, "semiannual", "2026-06-30", 1_030_000],
			[700, "annual", "2026-12-31", 1_070_000],
		] as const
		for (const [rate, compounding, date, expected] of cases) {
			const settled = capitaliseThrough(at(1_000_000, "2025-12-31"), { rate, compounding }, date)
			expect(settled.principal).toBe(BigInt(expected))
		}
	})

	it("counts leap February as twenty-eight days and capitalises on Feb 29", () => {
		const settled = capitaliseThrough(at(1_200_000, "2024-01-31"), monthly, "2024-02-29")
		expect(settled).toEqual(at(1_212_000, "2024-02-29"))
	})

	it("stops at the last supported date without leaving the calendar", () => {
		const settled = capitaliseThrough(at(1_000, "9998-12-31"), monthly, "9999-12-31")
		expect(settled.asOf).toBe("9999-12-31")
		expect(settled.principal).toBeGreaterThan(1_000n)
	})
})

describe("nominal value at a date", () => {
	it("reports accrued interest for a partial period", () => {
		const parts = accrualParts(at(1_200_000, "2025-12-31"), monthly, "2026-01-16")
		expect(parts).toEqual({ capitalised: 1_200_000n, accruedInterest: 6_194n, amount: 1_206_194n })
	})

	it("capitalises before reporting a compounding date", () => {
		const parts = accrualParts(at(1_200_000, "2025-12-31"), monthly, "2026-01-31")
		expect(parts).toEqual({ capitalised: 1_212_000n, accruedInterest: 0n, amount: 1_212_000n })
	})

	it("reports zero accrued on the opening date", () => {
		expect(accrualParts(at(1_200_000, "2026-01-16"), monthly, "2026-01-16")).toEqual({
			capitalised: 1_200_000n,
			accruedInterest: 0n,
			amount: 1_200_000n,
		})
	})

	it("keeps the exact numerator across a mid-period commit", () => {
		const committed = commitThrough(at(1_200_000, "2026-01-01"), "2026-01-16")
		expect(committed.principalDays).toBe(18_000_000n)
		const parts = accrualParts(committed, monthly, "2026-01-16")
		expect(parts.accruedInterest).toBe(5_806n)
	})
})

describe("period arithmetic used by the walk", () => {
	it("handles each period without a previous-period date at the lower bound", () => {
		const periods: readonly CompoundingPeriod[] = ["monthly", "quarterly", "semiannual", "annual"]
		for (const compounding of periods) {
			const settled = capitaliseThrough(
				at(1_000, "0001-01-01"),
				{ rate: 100, compounding },
				"0001-12-31",
			)
			expect(settled.asOf >= "0001-01-01").toBe(true)
		}
	})
})
