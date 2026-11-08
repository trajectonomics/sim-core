import type { ProjectionProblem } from "../types/projection"
import { type BufferFailure, bestBuffer, bestShortfall, type ShortfallFailure } from "./best"
import type { CandidateOutcome, SearchOutcome } from "./search"

export interface Accumulator {
	buffer?: BufferFailure
	shortfall?: ShortfallFailure
	problem?: ProjectionProblem
	done?: SearchOutcome
	stop?: boolean
}

export function consume(outcome: CandidateOutcome, acc: Accumulator): void {
	if (outcome.kind === "problem") {
		if (outcome.terminal === true) acc.done = outcome
		else acc.problem ??= outcome.problem
	} else if (outcome.kind === "reachable") acc.done = outcome
	else if (outcome.kind === "buffer") acc.buffer = bestBuffer(acc.buffer, outcome.failure)
	else if (outcome.kind === "shortfall") {
		acc.shortfall = bestShortfall(acc.shortfall, outcome.failure)
		if (outcome.beforeStop) acc.stop = true
	}
}
