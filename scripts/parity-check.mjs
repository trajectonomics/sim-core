// Runs the built package under Node (V8) against the hashes recorded under Bun (JavaScriptCore).
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { financialIndependence, project } from "../dist/index.mjs"

const cases = JSON.parse(readFileSync(new URL("../parity/cases.json", import.meta.url), "utf8"))
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex")
const failed = cases.filter(({ baseline, scenario, timeline, sha256, options, fiSha256 }) => {
	if (digest(project(baseline, scenario, timeline)) !== sha256) return true
	if (options === undefined) return false
	return digest(financialIndependence(baseline, scenario, timeline, options)) !== fiSha256
})
for (const { name } of failed) console.error(`parity mismatch: ${name}`)
if (failed.length > 0) process.exit(1)
console.log(`parity ok: ${cases.length} cases under node ${process.version}`)
