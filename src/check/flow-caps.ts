import type { Emit, Path } from "./codes"
import { isRecord } from "./shape"

type MeasureRecord = Readonly<Record<string, unknown>>

/** One Levy's Measures by id, first declaration winning, as the graph walk indexes them. */
function measuresOf(levy: MeasureRecord): Map<string, MeasureRecord> {
	const byId = new Map<string, MeasureRecord>()
	const measures = levy["measures"]
	if (!Array.isArray(measures)) return byId
	for (let index = 0; index < measures.length; index++) {
		const item: unknown = measures[index]
		if (!isRecord(item)) continue
		const id = item["id"]
		if (typeof id === "string" && !byId.has(id)) byId.set(id, item)
	}
	return byId
}

/** Levy Measures by id, for the named levy; a missing or invalid id is reported. */
function levyMeasures(
	levies: readonly unknown[],
	id: unknown,
	at: Path,
	emit: Emit,
): Map<string, MeasureRecord> | undefined {
	let found: MeasureRecord | undefined
	for (let index = 0; index < levies.length; index++) {
		const item: unknown = levies[index]
		if (!isRecord(item) || item["id"] !== id) continue
		found ??= item
	}
	if (found === undefined) {
		emit("UNKNOWN_LEVY", [...at, "levy"])
		return undefined
	}
	return measuresOf(found)
}

function checkUpTo(
	capped: MeasureRecord,
	at: Path,
	byId: ReadonlyMap<string, MeasureRecord>,
	emit: Emit,
): void {
	const upTo = capped["upTo"]
	if (typeof upTo !== "string" || upTo === "") return
	const measure = byId.get(upTo)
	const path: Path = [...at, "upTo"]
	if (measure === undefined) return void emit("UNKNOWN_MEASURE", path)
	if (measure["op"] !== "const") return void emit("CAP_NOT_CONST", path)
	const value = measure["value"]
	if (typeof value === "number" && Number.isSafeInteger(value) && value < 0) {
		emit("NEGATIVE_AMOUNT", path)
	}
}

function validRate(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 10_000
}

/** Every valid plain share the Flow asks for, summed over all Levies. */
function plainShares(flow: MeasureRecord): number {
	const list = flow["prepayments"]
	if (!Array.isArray(list)) return 0
	let total = 0
	for (let index = 0; index < list.length; index++) {
		const entry: unknown = list[index]
		if (isRecord(entry) && validRate(entry["bps"])) total += entry["bps"]
	}
	return total
}

/** Every share on the gross, plain and capped, may never ask for more than 10000 basis points. */
function checkShares(flow: MeasureRecord, capped: MeasureRecord, at: Path, emit: Emit): void {
	const share = capped["bps"]
	if (!validRate(share)) return
	if (plainShares(flow) + share > 10_000) emit("RATE_OUT_OF_RANGE", at)
}

function checkFlow(
	flow: unknown,
	index: number,
	levies: readonly unknown[],
	path: Path,
	emit: Emit,
): void {
	if (!isRecord(flow) || flow["kind"] !== "income") return
	const capped = flow["cappedPrepayment"]
	if (!isRecord(capped)) return
	const flowPath: Path = [...path, "flows", index]
	if (!Object.hasOwn(flow, "label")) emit("MISSING_KEY", [...flowPath, "label"])
	const at: Path = [...flowPath, "cappedPrepayment"]
	if (typeof capped["levy"] !== "string" || capped["levy"] === "") return
	const byId = levyMeasures(levies, capped["levy"], at, emit)
	if (byId !== undefined) checkUpTo(capped, at, byId, emit)
	checkShares(flow, capped, [...at, "bps"], emit)
}

/** Cross-rules for `cappedPrepayment`: income only, a label, its Levy's `const` cap, the two shares. */
export function checkFlowCaps(flows: unknown, levies: unknown, path: Path, emit: Emit): void {
	if (!Array.isArray(flows) || !Array.isArray(levies)) return
	for (let index = 0; index < flows.length; index++)
		checkFlow(flows[index], index, levies, path, emit)
}
