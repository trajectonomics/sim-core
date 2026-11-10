import type { ResolvedReturns } from "../engine/returns"
import type { Baseline, DateString, Scenario, Timeline } from "../types"
import type { FinancialIndependenceOptions } from "../types/financial-independence"
import type { ProjectionProblem } from "../types/projection"
import { inputFor, planBase, prefixFor } from "./plan-base"
import type { SearchInput } from "./search"

/** One SearchInput per Market path, sharing the state-independent scan inputs. */
export interface ProbabilityPlan {
	readonly inputs: readonly SearchInput[]
	readonly candidates: readonly DateString[]
	readonly problem?: ProjectionProblem
}

/** One unchanged-Scenario prefix per Market path; a prefix overflow fails the whole run. */
export function planProbability(
	baseline: Baseline,
	scenario: Scenario,
	timeline: Timeline,
	options: FinancialIndependenceOptions,
	series: readonly ResolvedReturns[],
): ProbabilityPlan | undefined {
	const base = planBase(baseline, scenario, timeline, options)
	if (base === undefined) return undefined
	const inputs: SearchInput[] = []
	for (const resolved of series) {
		const prefix = prefixFor(base, resolved)
		if (prefix.problem !== undefined) {
			return { inputs: [], candidates: base.candidates, problem: prefix.problem }
		}
		inputs.push(inputFor(base, prefix))
	}
	return { inputs, candidates: base.candidates }
}
