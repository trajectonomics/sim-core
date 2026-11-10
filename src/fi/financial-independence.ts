import { check } from "../check"
import { checkFinancialIndependenceOptions } from "../check/financial-independence"
import type { Baseline, Scenario, Timeline } from "../types"
import type {
	FinancialIndependenceDefinition,
	FinancialIndependenceResult,
	SurvivalOptions,
} from "../types/financial-independence"
import { unreachable } from "./binding"
import { planScan } from "./plan"
import { search } from "./search"

function definitionOf(options: SurvivalOptions): FinancialIndependenceDefinition {
	const spending = options.retirementSpending
	return {
		method: options.method,
		...(spending === undefined
			? {}
			: {
					retirementSpending: {
						amount: spending.amount,
						growth:
							typeof spending.growth === "string" ? spending.growth : { bps: spending.growth.bps },
					},
				}),
		...(options.minBufferMonths === undefined ? {} : { minBufferMonths: options.minBufferMonths }),
		definitionVersion: 1,
	}
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
	const plan = planScan(baseline, scenario, timeline, options)
	if (plan === undefined) {
		return {
			ok: true,
			financialIndependence: { reachable: false, definition, binding: "noCandidateMonth" },
		}
	}
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
