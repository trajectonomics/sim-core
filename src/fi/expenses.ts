import { addMonthsClamped } from "../calendar/arith"
import type { ResolvedCalendar } from "../calendar/business"
import { plannedAmounts } from "../engine/derive"
import type { DatedEvent } from "../engine/events"
import { buildEvents } from "../engine/events"
import type { DateString, Scenario, Timeline } from "../types"
import type { FinancialIndependenceOptions } from "../types/financial-independence"
import type { ProjectionProblem } from "../types/projection"
import { retirementMeasurements } from "./retirement-spending"

const LAST_SUPPORTED_DATE = "9998-12-31"

import type { WindowOutcome } from "./expense-window"
import { buildWindow, expenseBetween } from "./expense-window"

export type { ExpenseWindow, Measured, WindowOutcome } from "./expense-window"
export { expenseBetween }

function byDate(events: readonly DatedEvent[]): Map<DateString, DatedEvent[]> {
	const days = new Map<DateString, DatedEvent[]>()
	for (const event of events) {
		const day = days.get(event.date) ?? []
		day.push(event)
		days.set(event.date, day)
	}
	return days
}

/** One amount per Landed date, which is what an expense window sums over. */
function expensesOf(planned: ReturnType<typeof plannedAmounts>, events: readonly DatedEvent[]) {
	if (!planned.ok) return planned
	let amount = 0n
	for (const event of events) {
		if (event.flow.kind !== "expense") continue
		amount += event.amount ?? planned.planned.derived.get(event.flow.id) ?? 0n
	}
	return { ok: true as const, amount }
}

/** Expense amounts through `through`; a Derived expense is evaluated on its own Landed date. */
function originalExpenses(
	scenario: Scenario,
	timeline: Timeline,
	through: DateString,
	calendar: ResolvedCalendar | undefined,
): readonly Measurement[] | ProjectionProblem {
	const events = buildEvents(scenario, { ...timeline, horizon: through }, calendar)
	const measurements: Measurement[] = []
	for (const [date, day] of byDate(events)) {
		const planned = plannedAmounts(day, scenario.flows, date, scenario.economy.inflation)
		const measured = expensesOf(planned, day)
		if (!measured.ok) return measured.problem
		measurements.push({ date, amount: measured.amount })
	}
	return measurements
}

interface Measurement {
	readonly date: DateString
	readonly amount: bigint
}

/** Post-stop expense amounts from the first candidate through a full extra year past the horizon. */
export function expenseWindow(
	scenario: Scenario,
	timeline: Timeline,
	options: FinancialIndependenceOptions,
	firstCandidate: DateString,
	calendar: ResolvedCalendar | undefined,
): WindowOutcome {
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
	if ("code" in measurements) return { ok: false, problem: measurements }
	return { ok: true, window: buildWindow(measurements) }
}

/** Original-plan expenses through the horizon, ignoring retirement spending: the trailing window. */
export function originalExpenseWindow(
	scenario: Scenario,
	timeline: Timeline,
	calendar: ResolvedCalendar | undefined,
): WindowOutcome {
	const measurements = originalExpenses(scenario, timeline, timeline.horizon, calendar)
	if ("code" in measurements) return { ok: false, problem: measurements }
	return { ok: true, window: buildWindow(measurements) }
}
