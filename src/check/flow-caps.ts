import type { Emit, Path } from "./codes"
import { isRecord } from "./shape"

type MeasureRecord = Readonly<Record<string, unknown>>

/** Levy Measures by id, first declaration winning, as the graph walk indexes them. */
function measuresById(levy: MeasureRecord): Map<string, MeasureRecord> {
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

/** The two shares together may never ask for more than the gross. */
function checkShares(flow: MeasureRecord, capped: MeasureRecord, at: Path, emit: Emit): void {
	const share = capped["bps"]
	const plain = flow["prepaymentBps"]
	if (!validRate(share) || !validRate(plain)) return
	if (plain + share > 10_000) emit("RATE_OUT_OF_RANGE", at)
}

function checkFlow(
	flow: unknown,
	index: number,
	byId: ReadonlyMap<string, MeasureRecord>,
	path: Path,
	emit: Emit,
): void {
	if (!isRecord(flow) || flow["kind"] !== "income") return
	const capped = flow["cappedPrepayment"]
	if (!isRecord(capped)) return
	const flowPath: Path = [...path, "flows", index]
	if (!Object.hasOwn(flow, "label")) emit("MISSING_KEY", [...flowPath, "label"])
	const at: Path = [...flowPath, "cappedPrepayment"]
	checkUpTo(capped, at, byId, emit)
	checkShares(flow, capped, [...at, "bps"], emit)
}

/** Cross-rules for `cappedPrepayment`: income only, a label, a Levy `const` cap, and the two shares. */
export function checkFlowCaps(flows: unknown, levy: unknown, path: Path, emit: Emit): void {
	if (!Array.isArray(flows) || !isRecord(levy)) return
	const byId = measuresById(levy)
	for (let index = 0; index < flows.length; index++)
		checkFlow(flows[index], index, byId, path, emit)
}
