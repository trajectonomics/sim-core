import { addMonthsClamped } from "../calendar/arith"
import type { DateString, Timeline } from "../types"
import type { Check, Emit, Problem } from "./codes"
import { makeGuard } from "./guard"
import { inspectAccounts, inspectBuckets } from "./market-entries"
import { boundedInt, str } from "./scalars"
import { checkShape, isRecord, list, req } from "./shape"

const MAX_ROWS = 1200
const spanReturn = boundedInt(-9999, 10000, "RATE_OUT_OF_RANGE")
const weight = boundedInt(0, 4294967296, "INVALID_WEIGHT")

const bucket: Check = (value, path, emit) => {
	checkShape(value, path, { returnsBps: req(list(spanReturn)), weight: req(weight) }, emit)
}

const shape = { id: req(str), accounts: req(list(str)), buckets: req(list(bucket)) }

function monthStart(date: DateString): DateString {
	return `${date.slice(0, 7)}-01`
}

/** Month rows a path covers: one per month start from the Timeline start to its horizon. */
function rowCount(timeline: Timeline): number {
	let count = 0
	let date = timeline.start
	while (date < timeline.horizon && count <= MAX_ROWS) {
		count++
		date = addMonthsClamped(monthStart(date), 1)
	}
	return count
}

/** Validates a Return model and the row cap its generated paths depend on. */
export function checkReturnModel(
	value: unknown,
	accounts: readonly string[],
	timeline: Timeline,
): readonly Problem[] {
	const problems: Problem[] = []
	const emit: Emit = (code, path) => void problems.push({ code, path })
	const guard = makeGuard(emit)
	guard("model", undefined, () => {
		if (value === undefined) {
			emit("MISSING_KEY", ["model"])
			return
		}
		checkShape(value, ["model"], shape, emit)
		if (!isRecord(value)) return
		inspectAccounts(value, new Set(accounts), emit)
		inspectBuckets(value, emit)
	})
	guard("timeline", undefined, () => {
		if (rowCount(timeline) > MAX_ROWS) emit("TOO_MANY_ENTRIES", ["timeline", "horizon"])
	})
	return problems
}
