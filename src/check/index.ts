import { SCHEMA_VERSION } from "../vocab"
import { indexAccounts } from "./accounts"
import { checkBaseline } from "./baseline"
import type { Emit, Path, Problem } from "./codes"
import { makeGuard } from "./guard"
import { checkLevyStart } from "./levy-start"
import { checkScenario } from "./scenario"
import { isRecord } from "./shape"
import { checkTimeline } from "./timeline"

/** True (and no problem) unless a record's `schemaVersion` is not 1: then one error is emitted. */
function versionOk(value: unknown, path: Path, emit: Emit): boolean {
	if (!isRecord(value) || value["schemaVersion"] === SCHEMA_VERSION) return true
	emit("UNSUPPORTED_SCHEMA_VERSION", [...path, "schemaVersion"])
	return false
}

/**
 * Validates all three inputs in one pass. `[]` means valid; the engine refuses to run otherwise.
 * Accepts arbitrary values and never throws: an input that cannot be read at all (a throwing
 * getter, a revoked Proxy) yields a single `NOT_AN_OBJECT` problem at its root.
 */
export function check(baseline: unknown, scenario: unknown, timeline: unknown): readonly Problem[] {
	const problems: Problem[] = []
	const emit: Emit = (code, path) => void problems.push({ code, path })
	const guard = makeGuard(emit)
	const scenarioOk = guard("scenario", false, () => versionOk(scenario, ["scenario"], emit))
	const baselineOk = guard("baseline", false, () => versionOk(baseline, ["baseline"], emit))
	const accounts = guard("scenario", undefined, () =>
		scenarioOk && isRecord(scenario) ? indexAccounts(scenario["accounts"]) : undefined,
	)
	if (baselineOk)
		guard("baseline", undefined, () => checkBaseline(baseline, ["baseline"], accounts, emit))
	if (scenarioOk)
		guard("scenario", undefined, () => checkScenario(scenario, ["scenario"], accounts, emit))
	guard("timeline", undefined, () => checkTimeline(timeline, ["timeline"], emit))
	guard("timeline", undefined, () => checkLevyStart(scenario, timeline, emit))
	return problems
}
