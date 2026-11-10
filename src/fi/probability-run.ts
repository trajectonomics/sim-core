import { marketPaths } from "../market/paths"
import type { Baseline, ReturnModel, Scenario, Timeline } from "../types"
import type { ProbabilityThresholdOptions } from "../types/financial-independence"
import type { ProbabilityFinancialIndependenceResult } from "../types/financial-independence-result"
import { probabilityDefinition } from "./definition"
import { scanProbability } from "./probability"
import { planProbability } from "./probability-plan"

/** Runs every Market path through the survival FI test and reports the earliest threshold month. */
export function runProbability(
	baseline: Baseline,
	scenario: Scenario,
	timeline: Timeline,
	options: ProbabilityThresholdOptions,
	model: ReturnModel,
): ProbabilityFinancialIndependenceResult {
	const definition = probabilityDefinition(options, model.id)
	const series = marketPaths(model, BigInt(`0x${options.seed}`), options.paths, timeline)
	const plan = planProbability(baseline, scenario, timeline, options, series)
	if (plan === undefined) {
		return {
			ok: true,
			financialIndependence: { reachable: false, definition, binding: "noCandidateMonth" },
		}
	}
	if (plan.problem !== undefined) return { ok: false, problems: [plan.problem] }
	const outcome = scanProbability(plan, options.thresholdBps)
	if (outcome.kind === "problem") return { ok: false, problems: [outcome.problem] }
	if (outcome.kind === "reachable") {
		return {
			ok: true,
			financialIndependence: {
				reachable: true,
				definition,
				month: outcome.month,
				fiSurvivalBps: outcome.fiSurvivalBps,
			},
		}
	}
	return {
		ok: true,
		financialIndependence: {
			reachable: false,
			definition,
			binding: "thresholdNotReached",
			bestMonth: outcome.bestMonth,
		},
	}
}
