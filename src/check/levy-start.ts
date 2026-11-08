import { daysInMonth, parseDate } from "../calendar/civil"
import type { Emit } from "./codes"
import { isValidDate } from "./date"
import { isRecord } from "./shape"

/** Whether a Levy period's raw `{ month, day }` names a date that recurs in every year. */
function validPeriod(period: unknown): period is { readonly month: number; readonly day: number } {
	if (!isRecord(period)) return false
	const { month, day } = period
	return (
		Number.isSafeInteger(month) &&
		Number.isSafeInteger(day) &&
		(month as number) >= 1 &&
		(month as number) <= 12 &&
		(day as number) >= 1 &&
		(day as number) <= daysInMonth(2001, month as number)
	)
}

/**
 * Until Carry-in exists, the Baseline holds balances only, so the Timeline must start exactly on
 * a Settlement period start or the Levy could never see the earlier Flows of that period.
 * An unreadable input is left to the main guards; this check never reports it twice.
 */
export function checkLevyStart(scenario: unknown, timeline: unknown, emit: Emit): void {
	try {
		compareStart(scenario, timeline, emit)
	} catch {
		// A throwing getter or revoked Proxy is reported at its own root by the main guards.
	}
}

function compareStart(scenario: unknown, timeline: unknown, emit: Emit): void {
	if (!isRecord(scenario) || !isRecord(timeline)) return
	const levy = scenario["levy"]
	if (!isRecord(levy)) return
	const period = levy["period"]
	const start = timeline["start"]
	if (!validPeriod(period) || !isValidDate(start)) return
	const date = parseDate(start)
	if (date.month !== period.month || date.day !== period.day) {
		emit("START_NOT_PERIOD_START", ["timeline", "start"])
	}
}
