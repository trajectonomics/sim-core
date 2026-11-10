import { resolvedCalendar } from "../calendar/resolve"
import { carryInPeriods } from "../levy/periods"
import type { MonthDay } from "../types"
import type { Emit } from "./codes"
import { isValidDate } from "./date"
import { periodOf, recordsOf } from "./levy-carry-in"
import { isMonthDay } from "./month-day"
import { isRecord } from "./shape"

/** Period starts that must have a Carry-in record for this Timeline start. */
function requiredStarts(
	start: string,
	period: MonthDay,
	settlement: MonthDay,
	scenario: unknown,
): readonly string[] {
	return carryInPeriods(start, period, settlement, resolvedCalendar(scenario)).required
}

function missingStarts(
	records: readonly unknown[],
	scenario: unknown,
	start: string,
	period: MonthDay,
	settlement: MonthDay,
): readonly string[] {
	const present = new Set<string>()
	for (let index = 0; index < records.length; index++) {
		const item: unknown = records[index]
		if (isRecord(item) && typeof item["periodStart"] === "string") present.add(item["periodStart"])
	}
	return requiredStarts(start, period, settlement, scenario).filter(
		(required) => !present.has(required),
	)
}

function checkLevy(
	levy: unknown,
	index: number,
	scenario: unknown,
	start: string,
	emit: Emit,
): void {
	if (!isRecord(levy)) return
	const period = periodOf(levy)
	const settlement = levy["settlement"]
	if (period === undefined || !isMonthDay(settlement)) return
	const records = recordsOf(levy)
	if (records === undefined && Object.hasOwn(levy, "carryIn")) return
	const missing = missingStarts(records ?? [], scenario, start, period, settlement)
	for (let count = 0; count < missing.length; count++) {
		emit("MISSING_CARRY_IN", ["scenario", "levies", index, "carryIn"])
	}
}

function run(scenario: unknown, timeline: unknown, emit: Emit): void {
	if (!isRecord(scenario) || !isRecord(timeline)) return
	const levies = scenario["levies"]
	if (!Array.isArray(levies)) return
	const start = timeline["start"]
	if (!isValidDate(start)) return
	for (let index = 0; index < levies.length; index++) {
		checkLevy(levies[index], index, scenario, start, emit)
	}
}

/** Requires a Carry-in record for every period the Timeline start did not fully cover. */
export function checkLevyCarryIn(scenario: unknown, timeline: unknown, emit: Emit): void {
	try {
		run(scenario, timeline, emit)
	} catch {
		// A throwing getter or revoked Proxy is reported at its own root by the main guards.
	}
}
