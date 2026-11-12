import type { ResolvedCalendar } from "../calendar/business"
import type { Scenario, Timeline } from "../types"
import type { ReferenceOptions } from "../types/reference"
import type { WindowOutcome } from "./expense-window"
import { originalExpenseWindow } from "./expenses"
import { type ReferenceConfig, referenceConfig } from "./reference-config"
import { deflated, type ReferenceMoney } from "./reference-window"

/** The single expense window and money the reference reads, built once per scan. */
export interface ReferencePlan {
	readonly config: ReferenceConfig
	readonly money: ReferenceMoney
	readonly window: WindowOutcome
}

function termsWindow(outcome: WindowOutcome, money: ReferenceMoney): WindowOutcome {
	if (!money.real || !outcome.ok) return outcome
	return deflated(outcome.window, money)
}

/**
 * Builds the reference's window and money. The default path wraps the scan's own expense window,
 * so it computes nothing extra; the trailing window and deflation exist only when asked for.
 */
export function referencePlan(
	reference: ReferenceOptions | undefined,
	scenario: Scenario,
	timeline: Timeline,
	expenses: WindowOutcome,
	calendar: ResolvedCalendar | undefined,
): ReferencePlan {
	const config = referenceConfig(reference)
	const money = {
		start: timeline.start,
		inflation: scenario.economy.inflation,
		real: config.terms === "real",
	}
	const source =
		config.window === "trailing12Months"
			? originalExpenseWindow(scenario, timeline, calendar)
			: expenses
	return { config, money, window: termsWindow(source, money) }
}
