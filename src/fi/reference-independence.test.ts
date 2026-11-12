import { describe, expect, it } from "bun:test"
import type { Fixture } from "../fixtures/fixture"
import { financialIndependence } from "../index"
import type { SurvivalFinancialIndependenceResult, SurvivalOptions } from "../types"
import type { ReferenceOptions } from "../types/reference"
import { generateCases } from "./scan-generator"

const BLOCKS: readonly ReferenceOptions[] = [
	{},
	{ multiplier: 1 },
	{ multiplier: 100, basis: "allAssets" },
	{ basis: "accessibleNetWorth", window: "trailing12Months" },
	{ basis: "netWorth", terms: "real" },
	{ multiplier: 30, basis: "netWorth", window: "trailing12Months", terms: "real" },
]

/** Everything the FI test owns: the answer, never the reference. */
function answer(result: SurvivalFinancialIndependenceResult): unknown {
	if (!result.ok) return { ok: false, problems: result.problems }
	const fi = result.financialIndependence
	if (fi.reachable) return { month: fi.month, definition: fi.definition }
	const bestCase = "bestCase" in fi ? fi.bestCase : undefined
	return { binding: fi.binding, bestCase, definition: fi.definition }
}

function run(fixture: Fixture, options: SurvivalOptions) {
	return financialIndependence(fixture.baseline, fixture.scenario, fixture.timeline, options)
}

describe("the reference never changes the FI answer", () => {
	const cases = generateCases(10, 11n)
	it.each(cases.map((item) => [item.name, item] as const))("%s", (_name, item) => {
		const plain = run(item.fixture, item.options)
		for (const reference of BLOCKS) {
			expect(answer(run(item.fixture, { ...item.options, reference }))).toEqual(answer(plain))
		}
	})

	it("keeps the definition free of the reference block", () => {
		const [first] = generateCases(1, 3n)
		if (first === undefined) throw new Error("expected a generated case")
		const plain = run(first.fixture, first.options)
		const configured = run(first.fixture, {
			...first.options,
			reference: { multiplier: 40, basis: "netWorth", terms: "real" },
		})
		if (!plain.ok || !configured.ok) throw new Error("expected ok results")
		expect(configured.financialIndependence.definition).toEqual(
			plain.financialIndependence.definition,
		)
		expect(configured.financialIndependence.definition).not.toHaveProperty("reference")
	})
})
