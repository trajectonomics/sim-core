import { addMonthsClamped } from "../calendar/arith"
import type { DatedEvent } from "../engine/events"
import type { Scenario, Timeline } from "../types"
import type { SurvivalOptions, TwentyFiveTimesReference } from "../types/financial-independence"
import type { ProjectionProblem } from "../types/projection"
import { type BufferFailure, bestBuffer, bestShortfall, type ShortfallFailure } from "./best"
import { candidateFlows } from "./candidate-flows"
import { type ExpenseWindow, expenseBetween } from "./expenses"
import type { Prefix } from "./prefix"
import { twentyFiveTimes } from "./reference"
import { walkCandidate } from "./walk"

export interface SearchInput {
	readonly scenario: Scenario
	readonly timeline: Timeline
	readonly options: SurvivalOptions
	readonly candidates: readonly string[]
	readonly events: readonly DatedEvent[]
	readonly prefix: Prefix
	readonly expenses: ExpenseWindow
	readonly settlementDates: readonly string[]
	readonly minBufferMonths: number
}

export type SearchOutcome =
	| {
			readonly kind: "reachable"
			readonly month: string
			readonly reference: TwentyFiveTimesReference
	  }
	| {
			readonly kind: "unreachable"
			readonly buffer: BufferFailure | undefined
			readonly shortfall: ShortfallFailure | undefined
	  }
	| { readonly kind: "problem"; readonly problem: ProjectionProblem }

type CandidateOutcome =
	| { readonly kind: "skip" }
	| {
			readonly kind: "reachable"
			readonly month: string
			readonly reference: TwentyFiveTimesReference
	  }
	| { readonly kind: "buffer"; readonly failure: BufferFailure }
	| { readonly kind: "shortfall"; readonly failure: ShortfallFailure; readonly beforeStop: boolean }
	| { readonly kind: "problem"; readonly problem: ProjectionProblem }

function inspectCandidate(input: SearchInput, month: string): CandidateOutcome {
	const before = input.prefix.runsOut
	if (before !== undefined && month > before.date) {
		const shortfall = { date: before.date, unmet: before.unmet, undrawable: 0n }
		return { kind: "shortfall", failure: { month, shortfall }, beforeStop: true }
	}
	const point = input.prefix.points.get(month)
	if (point === undefined) return { kind: "skip" }
	const events = candidateFlows(input.events, input.timeline, month, input.options)
	const walked = walkCandidate({
		scenario: input.scenario,
		timeline: input.timeline,
		month,
		events,
		point,
		settlementDates: input.settlementDates,
		expenses: input.expenses,
		minBufferMonths: input.minBufferMonths,
	})
	if (walked.kind === "problem") return walked
	if (walked.kind === "buffer") return { kind: "buffer", failure: { month, breach: walked.breach } }
	if (walked.kind === "shortfall") {
		return { kind: "shortfall", failure: { month, shortfall: walked.shortfall }, beforeStop: false }
	}
	const annual = expenseBetween(input.expenses, month, addMonthsClamped(month, 12))
	const reference = twentyFiveTimes(point.states, month, annual)
	if (!reference.ok) return { kind: "problem", problem: reference.problem }
	return { kind: "reachable", month, reference: reference.reference }
}

interface Accumulator {
	buffer?: BufferFailure
	shortfall?: ShortfallFailure
	done?: SearchOutcome
}

function consume(outcome: CandidateOutcome, acc: Accumulator): void {
	if (outcome.kind === "problem" || outcome.kind === "reachable") acc.done = outcome
	else if (outcome.kind === "buffer") acc.buffer = bestBuffer(acc.buffer, outcome.failure)
	else if (outcome.kind === "shortfall") {
		acc.shortfall = bestShortfall(acc.shortfall, outcome.failure)
		if (outcome.beforeStop) {
			acc.done = { kind: "unreachable", buffer: acc.buffer, shortfall: acc.shortfall }
		}
	}
}

/** Ascending linear scan; returns the first pass, never assuming monotonicity. */
export function search(input: SearchInput): SearchOutcome {
	const acc: Accumulator = {}
	for (const month of input.candidates) {
		consume(inspectCandidate(input, month), acc)
		if (acc.done !== undefined) return acc.done
	}
	return { kind: "unreachable", buffer: acc.buffer, shortfall: acc.shortfall }
}
