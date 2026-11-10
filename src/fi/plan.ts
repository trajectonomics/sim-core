import type { Baseline, DateString, Scenario, Timeline } from "../types"
import type { FinancialIndependenceOptions } from "../types/financial-independence"
import { inputFor, planBase, prefixFor } from "./plan-base"
import type { SearchInput } from "./search"

/** Everything a scan needs except the candidate months it will visit. */
export interface ScanPlan {
	readonly input: SearchInput
	/** The full candidate grid. */
	readonly candidates: readonly DateString[]
	/** The candidates the scan visits: cut at the prefix stop when the prefix ran out. */
	readonly scanned: readonly DateString[]
}

/** Builds the state-independent scan inputs once; `undefined` when the candidate grid is empty. */
export function planScan(
	baseline: Baseline,
	scenario: Scenario,
	timeline: Timeline,
	options: FinancialIndependenceOptions,
): ScanPlan | undefined {
	const base = planBase(baseline, scenario, timeline, options)
	if (base === undefined) return undefined
	const prefix = prefixFor(base)
	const scanned =
		prefix.problem === undefined
			? base.candidates
			: base.candidates.filter(
					(month) => prefix.stoppedAt !== undefined && month <= prefix.stoppedAt,
				)
	return { input: inputFor(base, prefix), candidates: base.candidates, scanned }
}
