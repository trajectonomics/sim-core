import { describe, expect, it } from "bun:test"
import { expected } from "../testing"
import type { CarryIn } from "../types"
import { checkWith, LEVY } from "./levy-fixture"

const at = (...tail: readonly (string | number)[]) =>
	["scenario", "levies", 0, "carryIn", ...tail] as const

const empty = (periodStart: string): CarryIn => ({ periodStart, tallies: [], prepaid: 0 })

function levyWith(
	carryIn: readonly CarryIn[],
	patch: Readonly<Record<string, unknown>> = {},
): unknown {
	return { ...(LEVY as object), ...patch, carryIn }
}

describe("check() Carry-in", () => {
	it("accepts a start inside a period when that period's Carry-in is present", () => {
		expect(checkWith({ levy: levyWith([empty("2026-01-01")]) }, { start: "2026-06-01" })).toEqual(
			[],
		)
	})

	it("requires the earlier period whose Settlement falls after the start", () => {
		const { carryIn: _ignored, ...withoutCarryIn } = LEVY as Record<string, unknown>
		expect(checkWith({ levy: withoutCarryIn })).toEqual(expected("MISSING_CARRY_IN", at()))
		expect(checkWith({ levy: LEVY })).toEqual([])
	})

	it("rejects a missing Carry-in for a period containing a mid-period start", () => {
		expect(checkWith({ levy: levyWith([]) }, { start: "2026-06-01" })).toEqual(
			expected("MISSING_CARRY_IN", at()),
		)
	})

	it("reports both missing records when the current and earlier periods both need one", () => {
		const july = { ...(LEVY as object), settlement: { month: 7, day: 31 }, carryIn: [] }
		const codes = checkWith({ levy: july }, { start: "2026-06-01" }).map((item) => item.code)
		expect(codes).toEqual(["MISSING_CARRY_IN", "MISSING_CARRY_IN"])
	})

	it("rejects a duplicate periodStart at the second record", () => {
		const carryIn = [empty("2025-01-01"), empty("2025-01-01")]
		expect(checkWith({ levy: levyWith(carryIn) })).toEqual(
			expected("DUPLICATE_CARRY_IN", at(1, "periodStart")),
		)
	})

	it("rejects a periodStart that is not a Settlement period start", () => {
		const carryIn = [empty("2025-01-01"), empty("2026-02-01")]
		expect(checkWith({ levy: levyWith(carryIn) })).toEqual(
			expected("MISALIGNED_CARRY_IN", at(1, "periodStart")),
		)
	})

	it("rejects a tally label the Levy does not read", () => {
		const carryIn: readonly CarryIn[] = [
			{
				periodStart: "2025-01-01",
				tallies: [{ label: "mystery", basis: "gross", amount: 1 }],
				prepaid: 0,
			},
		]
		expect(checkWith({ levy: levyWith(carryIn) })).toEqual(
			expected("UNKNOWN_TALLY_LABEL", at(0, "tallies", 0, "label")),
		)
	})

	it("rejects a known label under a basis the Levy does not read", () => {
		const carryIn: readonly CarryIn[] = [
			{
				periodStart: "2025-01-01",
				tallies: [{ label: "salary", basis: "funded", amount: 1 }],
				prepaid: 0,
			},
		]
		expect(checkWith({ levy: levyWith(carryIn) })).toEqual(
			expected("UNKNOWN_TALLY_LABEL", at(0, "tallies", 0, "label")),
		)
	})

	it("accepts a label the Levy reads, with a prepaid amount", () => {
		const carryIn: readonly CarryIn[] = [
			{
				periodStart: "2025-01-01",
				tallies: [{ label: "salary", basis: "gross", amount: 1000 }],
				prepaid: 100,
			},
		]
		expect(checkWith({ levy: levyWith(carryIn) })).toEqual([])
	})

	it("checks the record shape", () => {
		const bad = [{ periodStart: "2025-01-01", tallies: [], prepaid: -1 }]
		expect(checkWith({ levy: levyWith(bad as unknown as readonly CarryIn[]) })).toEqual(
			expected("NEGATIVE_AMOUNT", at(0, "prepaid")),
		)
	})
})
