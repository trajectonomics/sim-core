import type { Emit, Path } from "./codes"
import { isValidDate } from "./date"
import { date, safeInt } from "./scalars"
import { checkShape, type Field, isRecord, list, opt, req, type Shape } from "./shape"

const stepShape: Shape = { from: req(date), value: req(safeInt) }

/** The optional `steps` field of a `const` Measure: a list of `{ from, value }` objects. */
export const steps: Field = opt(
	list((value, path, emit) => void checkShape(value, path, stepShape, emit)),
)

/** Reports a step whose date is not strictly after the previous valid one. */
function checkAscending(items: readonly unknown[], path: Path, emit: Emit): void {
	let previous: string | undefined
	for (let index = 0; index < items.length; index++) {
		const item: unknown = items[index]
		const from = isRecord(item) ? item["from"] : undefined
		if (!isValidDate(from)) continue
		if (previous !== undefined && from <= previous) {
			emit("STEPS_NOT_ASCENDING", [...path, "steps", index, "from"])
		}
		previous = from
	}
}

/** Rejects `asOf` and `growth` beside `steps`, and a step list that is empty or not ascending. */
export function checkSteps(
	measure: Readonly<Record<string, unknown>>,
	path: Path,
	emit: Emit,
): void {
	const items = measure["steps"]
	if (!Array.isArray(items)) return
	if (items.length === 0) emit("MISSING_KEY", [...path, "steps"])
	if (Object.hasOwn(measure, "asOf")) emit("FIELD_NOT_ALLOWED", [...path, "asOf"])
	if (Object.hasOwn(measure, "growth")) emit("FIELD_NOT_ALLOWED", [...path, "growth"])
	checkAscending(items, path, emit)
}
