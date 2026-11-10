/** TEST-ONLY per-candidate scan probe; not imported by `src/index.ts`, so it stays out of the package. */
import type { Fixture } from "../fixtures/fixture"
import type { DateString } from "../types"
import type { SurvivalOptions } from "../types/financial-independence"
import { planScan } from "./plan"
import { search } from "./search"

export type CandidateResult = "pass" | "fail"

export interface ScanPattern {
	readonly months: readonly DateString[]
	readonly results: readonly CandidateResult[]
}

/**
 * The pass/fail of each candidate in the scan's own ascending order. Each probe runs the real
 * one-candidate scan over the shared plan, so the pattern is the one the linear scan walks.
 */
export function scanPattern(fixture: Fixture, options: SurvivalOptions): ScanPattern {
	const plan = planScan(fixture.baseline, fixture.scenario, fixture.timeline, options)
	if (plan === undefined) return { months: [], results: [] }
	const results = plan.scanned.map(
		(month): CandidateResult =>
			search(plan.input, [month]).kind === "reachable" ? "pass" : "fail",
	)
	return { months: plan.scanned, results }
}
