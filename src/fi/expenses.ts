import { addMonthsClamped } from "../calendar/arith"
import type { ResolvedCalendar } from "../calendar/business"
import { occurrences } from "../calendar/occurrence"
import { amountAt } from "../engine/amount"
import type { DatedEvent } from "../engine/events"
import type { DateString, Scenario, Timeline } from "../types"
import type { SurvivalOptions } from "../types/financial-independence"
import { retirementMeasurements } from "./retirement-spending"

const LAST_SUPPORTED_DATE = "9998-12-31"

export interface ExpenseWindow {
	readonly dates: readonly DateString[]
	readonly cumulative: readonly bigint[]
}

interface Measurement {
	readonly date: DateString
	readonly amount: bigint
}

function originalExpenses(
	scenario: Scenario,
	timeline: Timeline,
	through: DateString,
	calendar: ResolvedCalendar | undefined,
): readonly Measurement[] {
	const measurements: Measurement[] = []
	for (const flow of scenario.flows) {
		if (flow.kind !== "expense") continue
		const found = occurrences(
			flow.start,
			flow.frequency,
			flow.end,
			timeline.start,
			through,
			calendar,
		)
		for (const occurrence of found) {
			const event: DatedEvent = { date: occurrence.date, flow, years: occurrence.years }
			measurements.push({
				date: occurrence.date,
				amount: amountAt(event, scenario.economy.inflation),
			})
		}
	}
	return measurements
}

function buildWindow(measurements: readonly Measurement[]): ExpenseWindow {
	const sorted = [...measurements].sort((left, right) =>
		left.date < right.date ? -1 : left.date > right.date ? 1 : 0,
	)
	const dates = sorted.map((measurement) => measurement.date)
	const cumulative: bigint[] = [0n]
	for (const measurement of sorted) {
		cumulative.push(cumulative[cumulative.length - 1]! + measurement.amount)
	}
	return { dates, cumulative }
}

/** Post-stop expense amounts from the first candidate through a full extra year past the horizon. */
export function expenseWindow(
	scenario: Scenario,
	timeline: Timeline,
	options: SurvivalOptions,
	firstCandidate: DateString,
	calendar: ResolvedCalendar | undefined,
): ExpenseWindow {
	const extended = addMonthsClamped(timeline.horizon, 12)
	const through = extended > LAST_SUPPORTED_DATE ? LAST_SUPPORTED_DATE : extended
	const retirement = options.retirementSpending
	const measurements =
		retirement === undefined
			? originalExpenses(scenario, timeline, through, calendar)
			: retirementMeasurements(
					timeline,
					retirement,
					firstCandidate,
					through,
					scenario.economy.inflation,
					calendar,
				)
	return buildWindow(measurements)
}

function lowerBound(dates: readonly DateString[], target: DateString): number {
	let low = 0
	let high = dates.length
	while (low < high) {
		const middle = Math.floor((low + high) / 2)
		if (dates[middle]! < target) low = middle + 1
		else high = middle
	}
	return low
}

/** Sum of measurement amounts in `[from, toExclusive)`. */
export function expenseBetween(
	window: ExpenseWindow,
	from: DateString,
	toExclusive: DateString,
): bigint {
	const low = lowerBound(window.dates, from)
	const high = lowerBound(window.dates, toExclusive)
	return window.cumulative[high]! - window.cumulative[low]!
}
