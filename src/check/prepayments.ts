import type { Check, Emit, Path } from "./codes"
import { boundedInt, str } from "./scalars"
import { checkShape, type Field, isRecord, opt, req } from "./shape"

const rate: Check = boundedInt(0, 10_000, "RATE_OUT_OF_RANGE")

const entryShape = { levy: req(str), bps: req(rate) }

/** One Levy's share, checked for its rate and the Levy it names. */
function checkEntry(
	item: unknown,
	path: Path,
	levyIds: ReadonlySet<string>,
	seen: Set<string>,
	emit: Emit,
): number {
	checkShape(item, path, entryShape, emit)
	if (!isRecord(item)) return 0
	const levy = item["levy"]
	if (typeof levy === "string" && !levyIds.has(levy)) emit("UNKNOWN_LEVY", [...path, "levy"])
	if (typeof levy === "string") {
		if (seen.has(levy)) emit("DUPLICATE_ID", [...path, "levy"])
		seen.add(levy)
	}
	const bps = item["bps"]
	return typeof bps === "number" && Number.isSafeInteger(bps) && bps >= 0 && bps <= 10_000 ? bps : 0
}

/** Prepayment shares: one entry per Levy at most, each 0 to 10000 bps, together at most 10000. */
export function checkPrepayments(
	value: unknown,
	path: Path,
	levyIds: ReadonlySet<string>,
	emit: Emit,
): void {
	if (!Array.isArray(value)) return void emit("NOT_AN_ARRAY", path)
	const seen = new Set<string>()
	let total = 0
	for (let index = 0; index < value.length; index++) {
		total += checkEntry(value[index], [...path, index], levyIds, seen, emit)
	}
	if (total > 10_000) emit("RATE_OUT_OF_RANGE", path)
}

/** The `prepayments` field of an income Flow; a Scenario with no Levy reports `LEVY_REQUIRED`. */
export function prepayments(hasLevy: boolean, levyIds: ReadonlySet<string>): Field {
	return opt((value, path, emit) => {
		if (hasLevy) checkPrepayments(value, path, levyIds, emit)
		else emit("LEVY_REQUIRED", path)
	})
}
