// Regenerates parity/cases.json from the engine under Bun. Run: bun run parity:update
import { createHash } from "node:crypto"
import { writeFileSync } from "node:fs"
import { project } from "../src/engine/project"
import { PARITY_CASES } from "../src/golden/parity-cases"
import { financialIndependence } from "../src/index"

function hash(value: unknown): string {
	return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

const cases = PARITY_CASES.map((testCase) => {
	const { name, fixture, options } = testCase
	const { baseline, scenario, timeline } = fixture
	const base = {
		name,
		baseline,
		scenario,
		timeline,
		sha256: hash(project(baseline, scenario, timeline)),
	}
	if (options === undefined) return base
	return {
		...base,
		options,
		fiSha256: hash(financialIndependence(baseline, scenario, timeline, options)),
	}
})
writeFileSync(
	new URL("../parity/cases.json", import.meta.url),
	`${JSON.stringify(cases, null, "\t")}\n`,
)
