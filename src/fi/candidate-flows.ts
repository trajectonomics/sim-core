import { addMonthsClamped, growthYears } from "../calendar/arith"
import type { DatedEvent } from "../engine/events"
import { compareIds } from "../engine/order"
import type { DateString, ExpenseFlow, Growth, Timeline } from "../types"
import type { SurvivalOptions } from "../types/financial-independence"

const RETIREMENT_ID = "fi-retirement-spending"

/** The synthetic Expense Flow behind retirement spending; its years are anchored at the Timeline start. */
export function retirementFlow(
	timeline: Timeline,
	amount: number,
	growth: Growth,
	id: string = RETIREMENT_ID,
): ExpenseFlow {
	return {
		id,
		kind: "expense",
		amount,
		frequency: "monthly",
		start: timeline.start,
		growth,
	}
}

function retirementFlows(
	month: DateString,
	timeline: Timeline,
	amount: number,
	growth: Growth,
	id: string,
): readonly DatedEvent[] {
	const flow = retirementFlow(timeline, amount, growth, id)
	const events: DatedEvent[] = []
	for (let date = month; date <= timeline.horizon; date = addMonthsClamped(date, 1)) {
		events.push({ date, flow, years: growthYears(timeline.start, date) })
	}
	return events
}

function stopped(dated: DatedEvent, retirement: boolean): boolean {
	if (dated.flow.kind === "income" && dated.flow.earned) return true
	return retirement && dated.flow.kind === "expense"
}

function uniqueRetirementId(events: readonly DatedEvent[]): string {
	const ids = new Set(events.map((event) => event.flow.id))
	let id = RETIREMENT_ID
	while (ids.has(id)) id += "-"
	return id
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
): readonly DatedEvent[] {
	const retirement = options.retirementSpending
	const kept = events.filter(
		(event) => event.date >= month && !stopped(event, retirement !== undefined),
	)
	if (retirement === undefined) return kept
	const added = retirementFlows(
		month,
		timeline,
		retirement.amount,
		retirement.growth,
		uniqueRetirementId(events),
	)
	return [...kept, ...added].sort(byDateThenId)
}
