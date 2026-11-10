import { describe, expect, it } from "bun:test"
import { evaluateMeasures } from "../levy/evaluate"
import { CONTEXT, levyOf, talliesOf } from "../levy/test-levy"
import type { LevyMeasure } from "../types"
import { checkWith, LEVY } from "./levy-fixture"

/** An array whose `map`, `forEach` and iterator lie: only index access tells the truth. */
function hostile<T>(items: readonly T[]): T[] {
	const array = [...items]
	for (const name of ["map", "forEach", "flatMap", "filter"]) {
		Object.defineProperty(array, name, { value: () => [] })
	}
	Object.defineProperty(array, Symbol.iterator, { value: () => [][Symbol.iterator]() })
	return array
}

const withMeasures = (measures: unknown[], due: string): readonly unknown[] =>
	checkWith({ levy: { ...(LEVY as object), measures, due } })

describe("check() Levy graph with lying array methods", () => {
	it("still reports a cycle", () => {
		const problems = withMeasures(hostile([{ id: "a", op: "add", a: "a", b: "a" }]), "a")
		expect(problems.map((p) => (p as { code: string }).code)).toContain("MEASURE_CYCLE")
	})

	it("still reports an unknown reference", () => {
		const problems = withMeasures(hostile([{ id: "a", op: "add", a: "ghost", b: "ghost" }]), "a")
		expect(problems.map((p) => (p as { code: string }).code)).toContain("UNKNOWN_MEASURE")
	})

	it("accepts a valid Levy", () => {
		const measures: LevyMeasure[] = [
			{ id: "b", op: "add", a: "a", b: "a" },
			{ id: "a", op: "const", value: 2 },
		]
		expect(withMeasures(hostile(measures), "b")).toEqual([])
	})
})

describe("evaluateMeasures with lying array methods", () => {
	it("evaluates a checked Levy declared out of dependency order", () => {
		const measures: LevyMeasure[] = [
			{ id: "b", op: "add", a: "a", b: "a" },
			{ id: "a", op: "const", value: 2 },
			{ id: "t", op: "tally", label: "x", basis: "gross" },
		]
		const result = evaluateMeasures(levyOf(hostile(measures), "b"), talliesOf(), CONTEXT)
		expect(result).toMatchObject({ ok: true, due: 4 })
	})
})
