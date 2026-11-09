import { closesWholeYear, duplicateHolidayIndex, isHolidayList } from "../calendar/resolve"
import { DAY_RULES } from "../vocab"
import type { Check, Emit, Path } from "./codes"
import { date, oneOf } from "./scalars"
import { checkShape, list, req } from "./shape"

const shape = {
	dayRule: req(oneOf(DAY_RULES, "INVALID_DAY_RULE")),
	holidays: req(list(date)),
}

/** Emits the two list-wide rules once the list itself has been walked for shape and dates. */
function reportUsability(holidays: unknown, path: Path, emit: Emit): void {
	if (!Array.isArray(holidays)) return
	const repeated = duplicateHolidayIndex(holidays)
	if (repeated !== undefined) emit("DUPLICATE_HOLIDAY", [...path, "holidays", repeated])
	if (isHolidayList(holidays) && closesWholeYear(holidays)) {
		emit("HOLIDAYS_UNUSABLE", [...path, "holidays"])
	}
}

/** Validates the optional Calendar: a closed day rule and a list of dated closures. */
export const checkCalendar: Check = (value, path, emit) => {
	const calendar = checkShape(value, path, shape, emit)
	if (calendar === undefined) return
	reportUsability(calendar["holidays"], path, emit)
}
