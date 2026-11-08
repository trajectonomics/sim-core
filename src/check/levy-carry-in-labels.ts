import { TALLY_BASES } from "../vocab"
import type { Emit, Path } from "./codes"
import { isRecord } from "./shape"

function knownTallies(levy: Readonly<Record<string, unknown>>): Set<string> {
	const known = new Set<string>()
	const measures = levy["measures"]
	if (!Array.isArray(measures)) return known
	for (let index = 0; index < measures.length; index++) {
		const measure: unknown = measures[index]
		if (!isRecord(measure) || measure["op"] !== "tally") continue
		const label = measure["label"]
		const basis = measure["basis"]
		if (typeof label === "string" && typeof basis === "string") known.add(`${basis}\u0000${label}`)
	}
	return known
}

function unknownLabel(entry: unknown, known: ReadonlySet<string>): boolean {
	if (!isRecord(entry)) return false
	const label = entry["label"]
	const basis = entry["basis"]
	if (typeof label !== "string" || typeof basis !== "string") return false
	if (!(TALLY_BASES as readonly string[]).includes(basis)) return false
	return !known.has(`${basis}\u0000${label}`)
}

function checkRecord(
	item: unknown,
	index: number,
	known: ReadonlySet<string>,
	path: Path,
	emit: Emit,
): void {
	if (!isRecord(item)) return
	const tallies = item["tallies"]
	if (!Array.isArray(tallies)) return
	for (let tally = 0; tally < tallies.length; tally++) {
		if (unknownLabel(tallies[tally], known)) {
			emit("UNKNOWN_TALLY_LABEL", [...path, "carryIn", index, "tallies", tally, "label"])
		}
	}
}

/** Rejects a Carry-in tally whose label and basis no Measure reads. */
export function checkLabels(
	records: readonly unknown[],
	levy: Readonly<Record<string, unknown>>,
	path: Path,
	emit: Emit,
): void {
	const known = knownTallies(levy)
	for (let index = 0; index < records.length; index++) {
		checkRecord(records[index], index, known, path, emit)
	}
}
