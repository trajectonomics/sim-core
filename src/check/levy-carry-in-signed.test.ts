import { describe, expect, it } from "bun:test"
import { expected } from "../testing"
import type { CarryIn } from "../types"
import { checkWith, LEVY } from "./levy-fixture"

const at = (...tail: readonly (string | number)[]) =>
	["scenario", "levies", 0, "carryIn", ...tail] as const

const signedLevy = {
	...(LEVY as object),
	measures: [
		...(LEVY as { measures: readonly unknown[] }).measures,
		{ id: "returns", op: "tally", label: "interest", basis: "returns" },
		{ id: "gains", op: "tally", label: "gain", basis: "gains" },
	],
}

function carryIn(tallies: readonly { label: string; basis: string; amount: number }[]): CarryIn[] {
	return [{ periodStart: "2025-01-01", tallies: tallies as never, prepaid: 0 }]
}

describe("check() Carry-in on a signed tally basis", () => {
	it("accepts a negative returns or gains amount", () => {
		expect(
			checkWith({
				levy: {
					...signedLevy,
					carryIn: carryIn([
						{ label: "interest", basis: "returns", amount: -5000 },
						{ label: "gain", basis: "gains", amount: -5000 },
					]),
				},
			}),
		).toEqual([])
	})

	it("still rejects a negative gross or funded amount", () => {
		expect(
			checkWith({
				levy: {
					...signedLevy,
					carryIn: carryIn([{ label: "salary", basis: "gross", amount: -1 }]),
				},
			}),
		).toEqual(expected("NEGATIVE_AMOUNT", at(0, "tallies", 0, "amount")))
	})

	it("accepts a positive returns amount and keeps the signed safe integer rule", () => {
		expect(
			checkWith({
				levy: {
					...signedLevy,
					carryIn: carryIn([{ label: "interest", basis: "returns", amount: 1.5 }]),
				},
			}),
		).toEqual(expected("NOT_SAFE_INTEGER", at(0, "tallies", 0, "amount")))
	})
})
