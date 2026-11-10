import type { DateString, Scenario, SurplusStep } from "../types"
import type { ProjectionProblem } from "../types/projection"
import type { LevyTracker } from "./levy-types"
import { minBigInt } from "./min"
import { mutate } from "./mutate"
import type { StateMap } from "./state"
import { valuation } from "./value"

interface FillResult {
	readonly remaining: bigint
	readonly problem: ProjectionProblem | undefined
}

function fillStep(
	states: StateMap,
	step: SurplusStep,
	date: DateString,
	remaining: bigint,
	tracker: LevyTracker | undefined,
): FillResult {
	const state = states.get(step.account)!
	const headroom = step.upTo === undefined ? remaining : BigInt(step.upTo) - valuation(state, date)
	let fill = 0n
	if (headroom > 0n) fill = minBigInt(remaining, headroom)
	if (fill === 0n) return { remaining, problem: undefined }
	const problem = mutate(state, date, fill, tracker)
	return problem === undefined
		? { remaining: remaining - fill, problem: undefined }
		: { remaining, problem }
}

export function applySurplus(
	states: StateMap,
	scenario: Scenario,
	date: DateString,
	amount: bigint,
	tracker: LevyTracker | undefined,
): ProjectionProblem | undefined {
	let remaining = amount
	for (const step of scenario.cashflow.surplus) {
		if (remaining === 0n) return undefined
		const result = fillStep(states, step, date, remaining, tracker)
		remaining = result.remaining
		if (result.problem !== undefined) return result.problem
	}
	return undefined
}
