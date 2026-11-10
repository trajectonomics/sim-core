import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { generateCases } from "../fi/scan-generator"
import { financialIndependence } from "../index"
import type { FinancialIndependenceResult } from "../types"
import { SCAN_CASES } from "./fi-scan-cases"
import { oracleFiMonth } from "./oracle-fi"

interface Snapshot {
	readonly cases: readonly {
		readonly name: string
		readonly options: unknown
		readonly result: FinancialIndependenceResult
	}[]
}

const snapshots = JSON.parse(
	readFileSync(new URL("./fi-snapshots.json", import.meta.url), "utf8"),
) as Snapshot

describe("frozen FI scan results", () => {
	for (const testCase of SCAN_CASES) {
		it(testCase.name, () => {
			const recorded = snapshots.cases.find((item) => item.name === testCase.name)
			expect(recorded).toBeDefined()
			const { baseline, scenario, timeline } = testCase.fixture
			expect(financialIndependence(baseline, scenario, timeline, testCase.options)).toEqual(
				recorded!.result,
			)
		})
	}

	it("matches the independent FI oracle on generated scenarios without a buffer", () => {
		const generated = generateCases(6, 3n).filter(
			(item) => item.options.minBufferMonths === undefined,
		)
		expect(generated.length).toBeGreaterThan(0)
		for (const item of generated) {
			const { baseline, scenario, timeline } = item.fixture
			const result = financialIndependence(baseline, scenario, timeline, item.options)
			const month =
				result.ok && result.financialIndependence.reachable
					? result.financialIndependence.month
					: undefined
			expect(month).toBe(oracleFiMonth(item.fixture, item.options))
		}
	})
})
