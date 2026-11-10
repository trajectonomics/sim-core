import type { DatedEvent } from "../engine/events"
import { compareIds } from "../engine/order"

/** Date-then-id ordering, the order `processDate` sees events in. */
export function byDateThenId(left: DatedEvent, right: DatedEvent): number {
	if (left.date !== right.date) return left.date < right.date ? -1 : 1
	return compareIds(left.flow.id, right.flow.id)
}

/** Merge two date-then-id ordered event lists into one. */
export function merge(
	left: readonly DatedEvent[],
	right: readonly DatedEvent[],
): readonly DatedEvent[] {
	if (right.length === 0) return left
	const merged: DatedEvent[] = []
	let leftIndex = 0
	let rightIndex = 0
	while (leftIndex < left.length && rightIndex < right.length) {
		if (byDateThenId(left[leftIndex]!, right[rightIndex]!) <= 0) merged.push(left[leftIndex++]!)
		else merged.push(right[rightIndex++]!)
	}
	while (leftIndex < left.length) merged.push(left[leftIndex++]!)
	while (rightIndex < right.length) merged.push(right[rightIndex++]!)
	return merged
}
