import type { BasisPoints, DateString } from "../types"
import type { ThresholdMonth } from "../types/financial-independence"
import type { ProjectionProblem } from "../types/projection"
import type { ProbabilityPlan } from "./probability-plan"
import type { SearchInput } from "./search"
import { walkCandidate } from "./walk"

export type ProbabilityOutcome =
	| { readonly kind: "reachable"; readonly month: DateString; readonly fiSurvivalBps: BasisPoints }
	| { readonly kind: "none"; readonly bestMonth: ThresholdMonth }
	| { readonly kind: "problem"; readonly problem: ProjectionProblem }

/** Whether one Market path passes the FI test at `month`, or the problem that stops the run. */
function passes(input: SearchInput, month: DateString): boolean | ProjectionProblem {
	const { prefix } = input
	if (prefix.runsOut !== undefined && month > prefix.runsOut.date) return false
	const point = prefix.points.get(month)
	if (point === undefined) return false
	const walked = walkCandidate(
		{ scenario: input.scenario, month, point, requirement: input.requirement },
		input.grid,
	)
	if (walked.kind === "problem") return walked.problem
	return walked.kind === "survived"
}

/** How many of one month's paths pass, or the first walk problem that stops the run. */
type Survivors =
	| { readonly kind: "count"; readonly survived: number }
	| { readonly kind: "problem"; readonly problem: ProjectionProblem }

function countSurvivors(inputs: readonly SearchInput[], month: DateString): Survivors {
	let survived = 0
	for (const input of inputs) {
		const passed = passes(input, month)
		if (typeof passed !== "boolean") return { kind: "problem", problem: passed }
		if (passed) survived++
	}
	return { kind: "count", survived }
}

/** Ascending scan for the earliest month whose FI survival share reaches the threshold. */
export function scanProbability(
	plan: ProbabilityPlan,
	thresholdBps: BasisPoints,
): ProbabilityOutcome {
	let best: ThresholdMonth | undefined
	for (const month of plan.candidates) {
		const total = countSurvivors(plan.inputs, month)
		if (total.kind === "problem") return { kind: "problem", problem: total.problem }
		const fiSurvivalBps = Math.floor((total.survived * 10000) / plan.inputs.length)
		if (best === undefined || fiSurvivalBps > best.fiSurvivalBps) best = { month, fiSurvivalBps }
		if (fiSurvivalBps >= thresholdBps) return { kind: "reachable", month, fiSurvivalBps }
	}
	return { kind: "none", bestMonth: best! }
}
