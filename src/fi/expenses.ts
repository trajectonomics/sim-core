import { addMonthsClamped, growthYears } from "../calendar/arith"
import { occurrences } from "../calendar/occurrence"
import { amountAt } from "../engine/amount"
import type { DatedEvent } from "../engine/events"
import type { DateString, Scenario, Timeline } from "../types"
import type { SurvivalOptions } from "../types/financial-independence"
import { retirementFlow } from "./candidate-flows"

const LAST_SUPPORTED_DATE = "9998-12-31"

export interface ExpenseWindow {
	readonly dates: readonly DateString[]
	readonly cumulative: readonly bigint[]
}

type Measurement = { readonly date: DateString; readonly amount: bigint }

type Retirement = NonNullable<SurvivalOptions["retirementSpending"]>

function originalExpenses(
	scenario: Scenario,
	timeline: Timeline,
	through: DateString,
): readonly Measurement[] {
	const measurements: Measurement[] = []
	for (const flow of scenario.flows) {
		if (flow.kind !== "expense") continue
		const found = occurrences(flow.start, flow.frequency, flow.end, timeline.start, through)
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

function retirementExpenses(
	timeline: Timeline,
	retirement: Retirement,
	firstCandidate: DateString,
	through: DateString,
	inflation: number,
): readonly Measurement[] {
	const flow = retirementFlow(timeline, retirement.amount, retirement.growth)
	const measurements: Measurement[] = []
	for (let date = firstCandidate; date <= through; date = addMonthsClamped(date, 1)) {
		const event: DatedEvent = { date, flow, years: growthYears(timeline.start, date) }
		measurements.push({ date, amount: amountAt(event, inflation) })
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
): ExpenseWindow {
	const extended = addMonthsClamped(timeline.horizon, 12)
	const through = extended > LAST_SUPPORTED_DATE ? LAST_SUPPORTED_DATE : extended
	const retirement = options.retirementSpending
	const measurements =
		retirement === undefined
			? originalExpenses(scenario, timeline, through)
			: retirementExpenses(
					timeline,
					retirement,
					firstCandidate,
					through,
					scenario.economy.inflation,
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
