import { addMonthsClamped } from "../calendar/arith"
import type { DateString, Scenario } from "../types"
import type { TwentyFiveTimesReference } from "../types/financial-independence"
import type { ProjectionProblem } from "../types/projection"
import { type Accumulator, consume } from "./accumulate"
import type { BufferFailure, ShortfallFailure } from "./best"
import { expenseBetween } from "./expenses"
import type { Prefix } from "./prefix"
import { twentyFiveTimes } from "./reference"
import type { RequirementTable } from "./required"
import type { ScanSchedule } from "./schedule"
import { walkCandidate } from "./walk"

export interface SearchInput {
	readonly scenario: Scenario
	readonly prefix: Prefix
	readonly requirement: RequirementTable
	readonly schedule: ScanSchedule
}

export type SearchOutcome =
	| {
			readonly kind: "reachable"
			readonly month: DateString
			readonly reference: TwentyFiveTimesReference
	  }
	| {
			readonly kind: "unreachable"
			readonly buffer: BufferFailure | undefined
			readonly shortfall: ShortfallFailure | undefined
	  }
	| { readonly kind: "problem"; readonly problem: ProjectionProblem; readonly terminal?: boolean }
export type CandidateOutcome =
	| { readonly kind: "skip" }
	| {
			readonly kind: "reachable"
			readonly month: DateString
			readonly reference: TwentyFiveTimesReference
	  }
	| { readonly kind: "buffer"; readonly failure: BufferFailure }
	| { readonly kind: "shortfall"; readonly failure: ShortfallFailure; readonly beforeStop: boolean }
	| { readonly kind: "problem"; readonly problem: ProjectionProblem; readonly terminal?: boolean }

function inspectCandidate(input: SearchInput, month: DateString): CandidateOutcome {
	const before = input.prefix.runsOut
	if (before !== undefined && month > before.date) {
		const shortfall = { date: before.date, unmet: before.unmet, undrawable: 0n }
		return { kind: "shortfall", failure: { month, shortfall }, beforeStop: true }
	}
	const point = input.prefix.points.get(month)
	if (point === undefined) return { kind: "skip" }
	const walked = walkCandidate(
		{ scenario: input.scenario, month, point, requirement: input.requirement },
		input.schedule,
	)
	if (walked.kind === "problem") return walked
	if (walked.kind === "buffer") return { kind: "buffer", failure: { month, breach: walked.breach } }
	if (walked.kind === "shortfall") {
		return { kind: "shortfall", failure: { month, shortfall: walked.shortfall }, beforeStop: false }
	}
	const annual = expenseBetween(input.requirement.expenses, month, addMonthsClamped(month, 12))
	const reference = twentyFiveTimes(point.states, month, annual)
	if (!reference.ok) return { kind: "problem", problem: reference.problem, terminal: true }
	return { kind: "reachable", month, reference: reference.reference }
}

/** Ascending linear scan over `months`; returns the first pass, never assuming monotonicity. */
export function search(input: SearchInput, months: readonly DateString[]): SearchOutcome {
	const acc: Accumulator = {}
	for (const month of months) {
		consume(inspectCandidate(input, month), acc)
		if (acc.done !== undefined) return acc.done
		if (acc.stop === true) break
	}
	if (acc.problem !== undefined) return { kind: "problem", problem: acc.problem }
	return { kind: "unreachable", buffer: acc.buffer, shortfall: acc.shortfall }
}
