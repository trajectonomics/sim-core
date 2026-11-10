import { parseDate } from "../calendar/civil"
import type { MonthDay } from "../types"
import { TALLY_BASES } from "../vocab"
import type { Check, Emit, Path } from "./codes"
import { isValidDate } from "./date"
import { checkLabels } from "./levy-carry-in-labels"
import { isMonthDay } from "./month-day"
import { amount, date, oneOf, safeInt, str } from "./scalars"
import { checkShape, isRecord, list, req } from "./shape"

/** `returns` and `gains` are signed; `gross` and `funded` cannot be a loss. */
const SIGNED_BASES: readonly string[] = ["returns", "gains"]

const amountFor = (basis: unknown): Check =>
	typeof basis === "string" && SIGNED_BASES.includes(basis) ? safeInt : amount

/** A tally entry whose amount rule depends on its basis. */
const tallyEntry: Check = (value, path, emit) => {
	const basis = isRecord(value) ? value["basis"] : undefined
	const shape = {
		label: req(str),
		basis: req(oneOf(TALLY_BASES, "INVALID_BASIS")),
		amount: req(amountFor(basis)),
	}
	checkShape(value, path, shape, emit)
}

const recordShape = {
	periodStart: req(date),
	tallies: req(list(tallyEntry)),
	prepaid: req(amount),
}

const record: Check = (value, path, emit) => void checkShape(value, path, recordShape, emit)

/** Structural check for `Levy.carryIn`; cross-record rules are in `checkCarryInRecords`. */
export const carryIn: Check = list(record)

export function recordsOf(levy: Readonly<Record<string, unknown>>): readonly unknown[] | undefined {
	const value = levy["carryIn"]
	return Array.isArray(value) ? value : undefined
}

export function periodOf(levy: Readonly<Record<string, unknown>>): MonthDay | undefined {
	const period = levy["period"]
	return isMonthDay(period) ? period : undefined
}

function checkAlignment(
	records: readonly unknown[],
	period: MonthDay,
	path: Path,
	emit: Emit,
): void {
	const seen = new Set<string>()
	for (let index = 0; index < records.length; index++) {
		const item: unknown = records[index]
		if (!isRecord(item)) continue
		const start = item["periodStart"]
		if (!isValidDate(start)) continue
		const { month, day } = parseDate(start)
		if (month !== period.month || day !== period.day) {
			emit("MISALIGNED_CARRY_IN", [...path, "carryIn", index, "periodStart"])
		}
		if (seen.has(start)) emit("DUPLICATE_CARRY_IN", [...path, "carryIn", index, "periodStart"])
		seen.add(start)
	}
}

/** Alignment, duplicate and label rules for a Levy whose `carryIn` has the right shape. */
export function checkCarryInRecords(
	levy: Readonly<Record<string, unknown>>,
	path: Path,
	emit: Emit,
): void {
	const records = recordsOf(levy)
	const period = periodOf(levy)
	if (records === undefined || period === undefined) return
	checkAlignment(records, period, path, emit)
	checkLabels(records, levy, path, emit)
}
