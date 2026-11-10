import type { ResolvedCalendar } from "../calendar/business"
import { fixedAmountAt } from "../engine/amount"
import type { DatedEvent } from "../engine/events"
import type { BasisPoints, DateString, Timeline } from "../types"
import type { FinancialIndependenceOptions } from "../types/financial-independence"
import { retirementEvents, uniqueRetirementId } from "./retirement-spending"
import { merge } from "./scan-merge"

export interface ScanGrid {
	/** Every original event the stop keeps, in date-then-id order. */
	readonly kept: readonly DatedEvent[]
	readonly keptDates: readonly DateString[]
	/** The retirement expenses from the first candidate, in month order, with their amounts. */
	readonly added: readonly DatedEvent[]
	readonly firstMonth: DateString
	/** Sorted unique dates of the whole scan: kept and added events, Settlements and the horizon. */
	readonly dates: readonly DateString[]
}

function stopped(event: DatedEvent, retirement: boolean): boolean {
	if (event.flow.kind === "income" && event.flow.earned) return true
	return retirement && event.flow.kind === "expense"
}

export function lowerBound(dates: readonly DateString[], target: DateString): number {
	let low = 0
	let high = dates.length
	while (low < high) {
		const middle = Math.floor((low + high) / 2)
		if (dates[middle]! < target) low = middle + 1
		else high = middle
	}
	return low
}

function monthIndex(date: DateString): number {
	return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1
}

function uniqueDates(
	events: readonly DatedEvent[],
	extra: readonly DateString[],
): readonly DateString[] {
	const dates = new Set<DateString>()
	for (const event of events) dates.add(event.date)
	for (const date of extra) dates.add(date)
	return [...dates].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
}

/** Builds the stop-filtered events once per scan, so a candidate only takes a suffix of them. */
export function scanGrid(
	events: readonly DatedEvent[],
	timeline: Timeline,
	options: FinancialIndependenceOptions,
	firstMonth: DateString,
	settlementDates: readonly DateString[],
	calendar: ResolvedCalendar | undefined,
	inflation: BasisPoints,
): ScanGrid {
	const retirement = options.retirementSpending
	const kept = events.filter((event) => !stopped(event, retirement !== undefined))
	const added =
		retirement === undefined
			? []
			: retirementEvents(
					firstMonth,
					timeline,
					retirement,
					uniqueRetirementId(events),
					calendar,
				).map((event) => ({
					...event,
					amount: fixedAmountAt(event.flow as never, event.years, inflation),
				}))
	return {
		kept,
		keptDates: kept.map((event) => event.date),
		added,
		firstMonth,
		dates: uniqueDates(kept, [
			...added.map((event) => event.date),
			...settlementDates,
			timeline.horizon,
		]),
	}
}

/** The events a candidate walks: the kept suffix from `month` plus retirement expenses from `month`. */
export function gridEvents(grid: ScanGrid, month: DateString): readonly DatedEvent[] {
	const kept = grid.kept.slice(lowerBound(grid.keptDates, month))
	const from = monthIndex(month) - monthIndex(grid.firstMonth)
	const added = grid.added.slice(Math.max(0, from))
	return merge(kept, added)
}

/** The dates a candidate walks: every scan date from `month` on, plus `month` itself. */
export function gridDates(grid: ScanGrid, month: DateString): readonly DateString[] {
	const rest = grid.dates.slice(lowerBound(grid.dates, month))
	return rest[0] === month ? rest : [month, ...rest]
}
