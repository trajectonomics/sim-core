import { daysInMonth } from "../calendar/civil"
import type { Check } from "./codes"
import { safeInt } from "./scalars"
import { checkShape, req } from "./shape"

/** Any non-leap year: a month and day that exist there exist every year (so no Feb 29). */
const COMMON_YEAR = 2001

/** `{ month, day }` naming a real calendar date that recurs yearly. */
export const monthDay: Check = (value, path, emit) => {
	const found = checkShape(value, path, { month: req(safeInt), day: req(safeInt) }, emit)
	const month = found?.["month"]
	const day = found?.["day"]
	if (!Number.isSafeInteger(month) || !Number.isSafeInteger(day)) return
	if ((day as number) < 1 || (day as number) > daysInMonth(COMMON_YEAR, month as number)) {
		emit("INVALID_MONTH_DAY", path)
	}
}
