import { parseDate } from "../calendar/civil"
import type { Emit } from "./codes"
import { isValidDate } from "./date"
import { isMonthDay } from "./month-day"
import { isRecord } from "./shape"

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
	if (!isMonthDay(period) || !isValidDate(start)) return
	const date = parseDate(start)
	if (date.month !== period.month || date.day !== period.day) {
		emit("START_NOT_PERIOD_START", ["timeline", "start"])
	}
}
