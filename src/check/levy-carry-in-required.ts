import { addDays } from "../calendar/arith"
import { periodStartAtOrBefore, previousPeriodStart, settlementAfter } from "../levy/periods"
import type { MonthDay } from "../types"
import type { Emit } from "./codes"
import { isValidDate } from "./date"
import { periodOf, recordsOf } from "./levy-carry-in"
import { isMonthDay } from "./month-day"
import { isRecord } from "./shape"

/** Period starts that must have a Carry-in record for this Timeline start. */
function requiredStarts(start: string, period: MonthDay, settlement: MonthDay): readonly string[] {
	const current = periodStartAtOrBefore(start, period)
	if (current === undefined) return []
	const required = start === current ? [] : [current]
	const previous = previousPeriodStart(current, period)
	const previousSettlement = settlementAfter(addDays(current, -1), settlement)
	if (previous !== undefined && previousSettlement >= start) required.push(previous)
	return required
}

function missingStarts(
	records: readonly unknown[],
	start: string,
	period: MonthDay,
	settlement: MonthDay,
): readonly string[] {
	const present = new Set<string>()
	for (let index = 0; index < records.length; index++) {
		const item: unknown = records[index]
		if (isRecord(item) && typeof item["periodStart"] === "string") present.add(item["periodStart"])
	}
	return requiredStarts(start, period, settlement).filter((required) => !present.has(required))
}

function run(scenario: unknown, timeline: unknown, emit: Emit): void {
	if (!isRecord(scenario) || !isRecord(timeline)) return
	const levy = scenario["levy"]
	if (!isRecord(levy)) return
	const period = periodOf(levy)
	const settlement = levy["settlement"]
	const start = timeline["start"]
	if (period === undefined || !isMonthDay(settlement)) return
	if (!isValidDate(start)) return
	const records = recordsOf(levy)
	if (records === undefined && Object.hasOwn(levy, "carryIn")) return
	const missing = missingStarts(records ?? [], start, period, settlement)
	for (let index = 0; index < missing.length; index++) {
		emit("MISSING_CARRY_IN", ["scenario", "levy", "carryIn"])
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
