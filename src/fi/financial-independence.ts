import { check } from "../check"
import { checkFinancialIndependenceOptions } from "../check/financial-independence"
import { buildEvents } from "../engine/events"
import type { Baseline, Scenario, Timeline } from "../types"
import type {
	FinancialIndependenceDefinition,
	FinancialIndependenceResult,
	SurvivalOptions,
} from "../types/financial-independence"
import { unreachable } from "./binding"
import { candidateMonths } from "./candidates"
import { expenseWindow } from "./expenses"
import { baselinePrefix, levyPlan } from "./prefix"
import { search } from "./search"

function definitionOf(options: SurvivalOptions): FinancialIndependenceDefinition {
	return { ...options, definitionVersion: 1 }
}

/** The earliest month at which stopping earned income survives to the horizon under the `survival` method. */
export function financialIndependence(
	baseline: Baseline,
	scenario: Scenario,
	timeline: Timeline,
	options: SurvivalOptions,
): FinancialIndependenceResult {
	const problems = [
		...check(baseline, scenario, timeline),
		...checkFinancialIndependenceOptions(options),
	]
	if (problems.length > 0) return { ok: false, problems }
	const definition = definitionOf(options)
	const candidates = candidateMonths(timeline)
	if (candidates.length === 0) {
		return {
			ok: true,
			financialIndependence: { reachable: false, definition, binding: "noCandidateMonth" },
		}
	}
	const events = buildEvents(scenario, timeline)
	const prefix = baselinePrefix(baseline, scenario, timeline, events, candidates)
	const scanned =
		prefix.problem === undefined
			? candidates
			: candidates.filter((month) => prefix.stoppedAt !== undefined && month <= prefix.stoppedAt)
	const plan = levyPlan(scenario, timeline)
	const outcome = search({
		scenario,
		timeline,
		options,
		candidates: scanned,
		events,
		prefix,
		expenses: expenseWindow(scenario, timeline, options, candidates[0]!),
		settlementDates: plan.settlementDates,
		minBufferMonths: options.minBufferMonths ?? 0,
	})
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
	if (prefix.problem !== undefined) return { ok: false, problems: [prefix.problem] }
	return {
		ok: true,
		financialIndependence: unreachable(definition, outcome.buffer, outcome.shortfall),
	}
}
