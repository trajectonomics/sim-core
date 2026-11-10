// Records src/golden/fi-snapshots.json from the current FI scan. Run: bun scripts/fi-snapshot-record.ts
import { writeFileSync } from "node:fs"
import { SCAN_CASES } from "../src/golden/fi-scan-cases"
import { financialIndependence } from "../src/index"

const cases = SCAN_CASES.map((testCase) => {
	const { baseline, scenario, timeline } = testCase.fixture
	return {
		name: testCase.name,
		options: testCase.options,
		result: financialIndependence(baseline, scenario, timeline, testCase.options),
	}
})
writeFileSync(
	new URL("../src/golden/fi-snapshots.json", import.meta.url),
	`${JSON.stringify({ cases }, null, "\t")}\n`,
)
