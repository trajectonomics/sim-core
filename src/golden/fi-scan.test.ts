import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { planScan } from "../fi/plan"
import { search } from "../fi/search"
import { financialIndependence } from "../index"
import type { FinancialIndependenceResult } from "../types"
import { SCAN_CASES } from "./fi-scan-cases"

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

	it("reports the first candidate whose own walk survives", () => {
		for (const testCase of SCAN_CASES) {
			const { baseline, scenario, timeline } = testCase.fixture
			const result = financialIndependence(baseline, scenario, timeline, testCase.options)
			const plan = planScan(baseline, scenario, timeline, testCase.options)
			const first = plan?.scanned.find((month) => search(plan.input, [month]).kind === "reachable")
			const month =
				result.ok && result.financialIndependence.reachable
					? result.financialIndependence.month
					: undefined
			expect(first).toBe(month)
		}
	})
})
