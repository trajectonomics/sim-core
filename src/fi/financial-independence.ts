import { check } from "../check"
import { checkFinancialIndependenceOptions } from "../check/financial-independence"
import { checkReturnModel } from "../check/market"
import type { Baseline, ReturnModel, Scenario, Timeline } from "../types"
import type {
	FinancialIndependenceOptions,
	ProbabilityThresholdOptions,
	SurvivalOptions,
} from "../types/financial-independence"
import type {
	FinancialIndependenceResult,
	ProbabilityFinancialIndependenceResult,
	SurvivalFinancialIndependenceResult,
} from "../types/financial-independence-result"
import { unreachable } from "./binding"
import { survivalDefinition } from "./definition"
import { derivedExpenseProblem } from "./derived-expense"
import { planScan } from "./plan"
import { runProbability } from "./probability-run"
import { search } from "./search"

function runSurvival(
	baseline: Baseline,
	scenario: Scenario,
	timeline: Timeline,
	options: SurvivalOptions,
): SurvivalFinancialIndependenceResult {
	const definition = survivalDefinition(options)
	const plan = planScan(baseline, scenario, timeline, options)
	if (plan === undefined)
		return { ok: true, financialIndependence: unreachable(definition, undefined, undefined) }
	const outcome = search(plan.input, plan.scanned)
	if (outcome.kind === "problem") return { ok: false, problems: [outcome.problem] }
	if (outcome.kind === "reachable") {
		return {
			ok: true,
			financialIndependence: {
				reachable: true,
				definition,
				month: outcome.month,
				reference: outcome.reference,
			},
		}
	}
	const problem = plan.input.prefix.problem
	if (problem !== undefined) return { ok: false, problems: [problem] }
	return {
		ok: true,
		financialIndependence: unreachable(definition, outcome.buffer, outcome.shortfall),
	}
}

/**
 * The earliest month at which stopping earned income passes the FI test: for `survival` on one
 * deterministic Projection, for `probabilityThreshold` on at least `thresholdBps` of Market paths.
 */
export function financialIndependence(
	baseline: Baseline,
	scenario: Scenario,
	timeline: Timeline,
	options: SurvivalOptions,
	model?: ReturnModel,
): SurvivalFinancialIndependenceResult
export function financialIndependence(
	baseline: Baseline,
	scenario: Scenario,
	timeline: Timeline,
	options: ProbabilityThresholdOptions,
	model: ReturnModel,
): ProbabilityFinancialIndependenceResult
export function financialIndependence(
	baseline: Baseline,
	scenario: Scenario,
	timeline: Timeline,
	options: FinancialIndependenceOptions,
	model?: ReturnModel,
): FinancialIndependenceResult
export function financialIndependence(
	baseline: Baseline,
	scenario: Scenario,
	timeline: Timeline,
	options: FinancialIndependenceOptions,
	model?: ReturnModel,
): FinancialIndependenceResult {
	const problems = [
		...check(baseline, scenario, timeline),
		...checkFinancialIndependenceOptions(options),
	]
	if (problems.length > 0) return { ok: false, problems }
	if (options.retirementSpending === undefined) {
		const derived = derivedExpenseProblem(scenario)
		if (derived !== undefined) return { ok: false, problems: [derived] }
	}
	if (options.method === "survival") return runSurvival(baseline, scenario, timeline, options)
	if (model === undefined) {
		return { ok: false, problems: [{ code: "MISSING_KEY", path: ["model"] }] }
	}
	const modelProblems = checkReturnModel(
		model,
		scenario.accounts.map((item) => item.id),
		timeline,
	)
	if (modelProblems.length > 0) return { ok: false, problems: modelProblems }
	return runProbability(baseline, scenario, timeline, options, model)
}
