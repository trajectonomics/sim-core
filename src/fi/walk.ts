import { type DatedEvent, flowsAt } from "../engine/events"
import { hasSettlement } from "../engine/levy-tally"
import { processDate } from "../engine/occurrence"
import { isSafeInteger, overflow } from "../engine/overflow"
import type { DateString, Scenario } from "../types"
import type { ProjectionProblem } from "../types/projection"
import { type BufferBreach, checkBuffer } from "./buffer"
import { cloneStates } from "./clone"
import type { PrefixPoint } from "./prefix"
import type { RequirementTable } from "./required"
import { type ScanSchedule, scheduleDates, scheduleFlows } from "./schedule"
import { lockedOrAbsentAssets } from "./undrawable"

export interface Shortfall {
	readonly date: DateString
	readonly unmet: bigint
	readonly undrawable: bigint
}

export type WalkOutcome =
	| { readonly kind: "survived" }
	| { readonly kind: "buffer"; readonly breach: BufferBreach }
	| { readonly kind: "shortfall"; readonly shortfall: Shortfall }
	| { readonly kind: "problem"; readonly problem: ProjectionProblem }

export interface WalkInput {
	readonly scenario: Scenario
	readonly month: DateString
	readonly point: PrefixPoint
	readonly requirement: RequirementTable
}

type DayOutcome =
	| { readonly kind: "ok"; readonly breach?: BufferBreach }
	| { readonly kind: "shortfall"; readonly shortfall: Shortfall }
	| { readonly kind: "problem"; readonly problem: ProjectionProblem }

function processFlows(
	input: WalkInput,
	date: DateString,
	dayEvents: readonly DatedEvent[],
): DayOutcome {
	const { scenario, point } = input
	const tracker = point.tracker
	const settlement = tracker !== undefined && hasSettlement(tracker, date)
	if (dayEvents.length === 0 && !settlement) return { kind: "ok" }
	const outcome = processDate(point.states, scenario, date, dayEvents, tracker)
	if (outcome.problem !== undefined) return { kind: "problem", problem: outcome.problem }
	if (outcome.runsOut === undefined) return { kind: "ok" }
	if (!isSafeInteger(outcome.runsOut.unmet)) return { kind: "problem", problem: overflow(date) }
	const undrawable = lockedOrAbsentAssets(point.states, scenario, date)
	if ("problem" in undrawable) return { kind: "problem", problem: undrawable.problem }
	return {
		kind: "shortfall",
		shortfall: {
			date: outcome.runsOut.date,
			unmet: outcome.runsOut.unmet,
			undrawable: undrawable.value,
		},
	}
}

function processDay(
	input: WalkInput,
	date: DateString,
	dayEvents: readonly DatedEvent[],
): DayOutcome {
	const flows = processFlows(input, date, dayEvents)
	if (flows.kind !== "ok" || input.requirement.months === 0) return flows
	const checked = checkBuffer(input.point.states, date, input.requirement)
	if (checked.kind === "problem") return { kind: "problem", problem: checked.problem }
	if (checked.kind === "breach") return { kind: "ok", breach: checked.breach }
	return { kind: "ok" }
}

/** Continues a candidate from its unchanged prefix, checking survival and the optional buffer. */
export function walkCandidate(input: WalkInput, schedule: ScanSchedule): WalkOutcome {
	const point = { states: cloneStates(input.point.states), tracker: input.point.tracker }
	const working: WalkInput = { ...input, point }
	const events = scheduleFlows(schedule, input.month)
	const dates = scheduleDates(schedule, input.month)
	let index = 0
	let firstBreach: BufferBreach | undefined
	for (const date of dates) {
		const [next, dayEvents] = flowsAt(events, index, date)
		index = next
		const day = processDay(working, date, dayEvents)
		if (day.kind !== "ok") return day
		if (day.breach !== undefined && firstBreach === undefined) firstBreach = day.breach
	}
	return firstBreach === undefined ? { kind: "survived" } : { kind: "buffer", breach: firstBreach }
}
