import { refKeysOf } from "../levy/refs"
import { TALLY_BASES } from "../vocab"
import { isRecord } from "./shape"

/** One `(basis, label)` pair as a set key; `undefined` for a pair the engine would not tally. */
export function tallyKey(basis: unknown, label: unknown): string | undefined {
	if (typeof basis !== "string" || typeof label !== "string" || label === "") return undefined
	if (!(TALLY_BASES as readonly string[]).includes(basis)) return undefined
	return `${basis}\u0000${label}`
}

/** Measures by id, first declaration winning, as the graph check indexes them. */
function measuresById(measures: unknown): Map<string, unknown> {
	const byId = new Map<string, unknown>()
	if (!Array.isArray(measures)) return byId
	for (let index = 0; index < measures.length; index++) {
		const item: unknown = measures[index]
		const id = isRecord(item) ? item["id"] : undefined
		if (typeof id === "string" && !byId.has(id)) byId.set(id, item)
	}
	return byId
}

/** The ids of the Measures one Measure reads, in `REF_KEYS` order. */
function operandsOf(item: Readonly<Record<string, unknown>>): readonly string[] {
	const op = item["op"]
	const ids: string[] = []
	for (const key of typeof op === "string" ? refKeysOf(op) : []) {
		const target = item[key]
		if (typeof target === "string") ids.push(target)
	}
	return ids
}

/** Adds one Measure's tally pair, or queues the Measures it reads. */
function visit(
	id: string,
	byId: ReadonlyMap<string, unknown>,
	pairs: Set<string>,
	pending: string[],
): void {
	const measure = byId.get(id)
	if (!isRecord(measure)) return
	if (measure["op"] === "tally") {
		const pair = tallyKey(measure["basis"], measure["label"])
		if (pair !== undefined) pairs.add(pair)
		return
	}
	pending.push(...operandsOf(measure))
}
/**
 * The `(basis, label)` pairs of the `tally` Measures reachable from `due`. Index access and a
 * visited set, so a `MEASURE_CYCLE` cannot loop and an array whose iteration methods lie cannot
 * throw. Empty when the graph cannot be read, which the shape and graph checks report instead.
 */
export function readTallies(levy: Readonly<Record<string, unknown>>): ReadonlySet<string> {
	const pairs = new Set<string>()
	const due = levy["due"]
	if (typeof due !== "string") return pairs
	const byId = measuresById(levy["measures"])
	const seen = new Set<string>()
	const pending = [due]
	while (pending.length > 0) {
		const id = pending.pop()
		if (id === undefined || seen.has(id)) continue
		seen.add(id)
		visit(id, byId, pairs, pending)
	}
	return pairs
}
