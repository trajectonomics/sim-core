import { BASELINE_SCHEMA_VERSION, SCENARIO_SCHEMA_VERSION } from "../vocab"
import { indexAccounts } from "./accounts"
import { checkBaseline } from "./baseline"
import { checkBaselineBasis } from "./baseline-basis"
import type { Emit, Path, Problem } from "./codes"
import { makeGuard } from "./guard"
import { checkLevyCarryIn } from "./levy-carry-in-required"
import { checkScenario } from "./scenario"
import { isRecord } from "./shape"
import { checkTimeline } from "./timeline"

/** True (and no problem) unless a record's `schemaVersion` is not `expected`. */
function versionOk(value: unknown, path: Path, expected: number, emit: Emit): boolean {
	if (!isRecord(value) || value["schemaVersion"] === expected) return true
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
	const scenarioOk = guard("scenario", false, () =>
		versionOk(scenario, ["scenario"], SCENARIO_SCHEMA_VERSION, emit),
	)
	const baselineOk = guard("baseline", false, () =>
		versionOk(baseline, ["baseline"], BASELINE_SCHEMA_VERSION, emit),
	)
	const accounts = guard("scenario", undefined, () =>
		scenarioOk && isRecord(scenario) ? indexAccounts(scenario["accounts"]) : undefined,
	)
	if (baselineOk)
		guard("baseline", undefined, () => checkBaseline(baseline, ["baseline"], accounts, emit))
	if (baselineOk && scenarioOk)
		guard("baseline", undefined, () => checkBaselineBasis(baseline, scenario, emit))
	if (scenarioOk)
		guard("scenario", undefined, () => checkScenario(scenario, ["scenario"], accounts, emit))
	guard("timeline", undefined, () => checkTimeline(timeline, ["timeline"], emit))
	guard("timeline", undefined, () => checkLevyCarryIn(scenario, timeline, emit))
	return problems
}
