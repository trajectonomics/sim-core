import { daysInMonth } from "../calendar/civil"
import type { MonthDay } from "../types"
import type { Check } from "./codes"
import { safeInt } from "./scalars"
import { checkShape, isRecord, req } from "./shape"

/** Any non-leap year: a month and day that exist there exist every year (so no Feb 29). */
const COMMON_YEAR = 2001

function calendarMonthDay(month: unknown, day: unknown): boolean {
	return (
		Number.isSafeInteger(month) &&
		Number.isSafeInteger(day) &&
		(month as number) >= 1 &&
		(month as number) <= 12 &&
		(day as number) >= 1 &&
		(day as number) <= daysInMonth(COMMON_YEAR, month as number)
	)
}

/** Whether a raw value names a `{ month, day }` that exists in every year. */
export function isMonthDay(value: unknown): value is MonthDay {
	return isRecord(value) && calendarMonthDay(value["month"], value["day"])
}

/** `{ month, day }` naming a real calendar date that recurs yearly. */
export const monthDay: Check = (value, path, emit) => {
	const found = checkShape(value, path, { month: req(safeInt), day: req(safeInt) }, emit)
	const month = found?.["month"]
	const day = found?.["day"]
	if (!Number.isSafeInteger(month) || !Number.isSafeInteger(day)) return
	if (!calendarMonthDay(month, day)) emit("INVALID_MONTH_DAY", path)
}
