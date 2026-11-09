import type { ResolvedCalendar } from "../calendar/business"
import type { DatedEvent } from "../engine/events"
import { compareIds } from "../engine/order"
import type { DateString, Timeline } from "../types"
import type { SurvivalOptions } from "../types/financial-independence"
import { retirementEvents, uniqueRetirementId } from "./retirement-spending"

function stopped(dated: DatedEvent, retirement: boolean): boolean {
	if (dated.flow.kind === "income" && dated.flow.earned) return true
	return retirement && dated.flow.kind === "expense"
}

function byDateThenId(left: DatedEvent, right: DatedEvent): number {
	if (left.date !== right.date) return left.date < right.date ? -1 : 1
	return compareIds(left.flow.id, right.flow.id)
}

/** Original events from `month` onward, with earned income (and replaced expenses) filtered out. */
export function candidateFlows(
	events: readonly DatedEvent[],
	timeline: Timeline,
	month: DateString,
	options: SurvivalOptions,
	calendar: ResolvedCalendar | undefined,
): readonly DatedEvent[] {
	const retirement = options.retirementSpending
	const kept = events.filter(
		(event) => event.date >= month && !stopped(event, retirement !== undefined),
	)
	if (retirement === undefined) return kept
	const added = retirementEvents(month, timeline, retirement, uniqueRetirementId(events), calendar)
	return [...kept, ...added].sort(byDateThenId)
}
