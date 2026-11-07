import { describe, expect, it } from "bun:test"
import { evaluateMeasures } from "./evaluate"
import { CONTEXT, talliesOf } from "./test-levy"
import { TH_LIKE } from "./th-levy"

function run(salary: number, saved: number) {
	const result = evaluateMeasures(
		TH_LIKE,
		talliesOf([["salary", salary]], [["fund", saved]]),
		CONTEXT,
	)
	if (!result.ok) throw new Error("unexpected overflow")
	return result
}

describe("a TH-like Levy", () => {
	it("caps the 50% deduction at 100,000.00 and the allowance at 15% of income", () => {
		// income 1,234,567.89: half = 617,283.945 -> floor 61,728,394 -> whole units 61,728,300 -> capped 10,000,000
		// allowance: min(saved 20,000,000, 15% = 18,518,518.35 -> 18,518,518, ceiling 50,000,000)
		// net = 123,456,789 - 10,000,000 - 18,518,518 - 6,000,000 = 88,938,271
		const { values, due } = run(123_456_789, 20_000_000)
		expect(values.get("halfWhole")).toBe(61_728_300)
		expect(values.get("deduction")).toBe(10_000_000)
		expect(values.get("allowance")).toBe(18_518_518)
		expect(values.get("net")).toBe(88_938_271)
		// bands: 5% of 15,000,000 + 10% of 20,000,000 + 15% of 25,000,000
		// + 20% of 13,938,271 (= 2,787,654.2 -> 2,787,654)
		expect(values.get("slice1")).toBe(750_000)
		expect(values.get("slice2")).toBe(2_000_000)
		expect(values.get("slice3")).toBe(3_750_000)
		expect(values.get("slice4")).toBe(2_787_654)
		expect(due).toBe(9_287_654)
	})

	it("floors the deduction to whole units when it is under the cap", () => {
		// income 15,001.35: half = 750,067.5 -> 750,067 -> whole units 750,000
		const { values } = run(1_500_135, 0)
		expect(values.get("half")).toBe(750_067)
		expect(values.get("deduction")).toBe(750_000)
	})

	it("owes nothing when the net is below the first band, never a negative slice", () => {
		// net = 1,500,135 - 750,000 - 0 - 6,000,000 = -5,249,865
		const { values, due } = run(1_500_135, 0)
		expect(values.get("net")).toBe(-5_249_865)
		expect(values.get("inside1")).toBe(0)
		expect(due).toBe(0)
	})

	it("lets the ceiling bind the allowance when 15% of income is higher", () => {
		// income 5,000,000.00: 15% = 75,000,000, saved 100,000,000, ceiling 50,000,000
		const { values } = run(500_000_000, 100_000_000)
		expect(values.get("allowanceShare")).toBe(75_000_000)
		expect(values.get("allowance")).toBe(50_000_000)
	})

	it("lets what was saved bind the allowance when it is the lowest", () => {
		const { values } = run(123_456_789, 10_000_000)
		expect(values.get("allowance")).toBe(10_000_000)
	})

	it("reads a label that was never tallied as 0", () => {
		const result = evaluateMeasures(TH_LIKE, talliesOf(), CONTEXT)
		expect(result).toMatchObject({ ok: true, due: 0 })
	})
})
