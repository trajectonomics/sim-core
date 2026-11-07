import { refKeysOf } from "../levy/refs"
import type { Emit, Path } from "./codes"
import { isRecord } from "./shape"

interface Edge {
	readonly to: number
	readonly path: Path
}

function indexIds(measures: readonly unknown[]): Map<string, number> {
	const ids = new Map<string, number>()
	for (let index = 0; index < measures.length; index++) {
		const item: unknown = measures[index]
		const id = isRecord(item) ? item["id"] : undefined
		if (typeof id === "string" && !ids.has(id)) ids.set(id, index)
	}
	return ids
}

/** Edges of one Measure; a reference to an id that is not a Measure is reported instead. */
function edgesOf(item: unknown, at: Path, ids: Map<string, number>, emit: Emit): Edge[] {
	if (!isRecord(item)) return []
	const edges: Edge[] = []
	const op = item["op"]
	for (const key of typeof op === "string" ? refKeysOf(op) : []) {
		const target = item[key]
		const to = typeof target === "string" ? ids.get(target) : undefined
		if (to !== undefined) edges.push({ to, path: [...at, key] })
		else if (typeof target === "string") emit("UNKNOWN_MEASURE", [...at, key])
	}
	return edges
}

/** Depth-first walk; an edge back to a Measure still being visited closes a cycle. */
function reportCycles(edges: readonly (readonly Edge[])[], emit: Emit): void {
	const state = new Array<0 | 1 | 2>(edges.length).fill(0)
	const visit = (index: number): void => {
		state[index] = 1
		for (const edge of edges[index] ?? []) {
			if (state[edge.to] === 1) emit("MEASURE_CYCLE", edge.path)
			else if (state[edge.to] === 0) visit(edge.to)
		}
		state[index] = 2
	}
	for (let index = 0; index < edges.length; index++) if (state[index] === 0) visit(index)
}

/** Reports unknown Measure references (operands and `due`) and cycles among the Measures. */
export function checkGraph(levy: Readonly<Record<string, unknown>>, path: Path, emit: Emit): void {
	const measures = levy["measures"]
	if (!Array.isArray(measures)) return
	const ids = indexIds(measures)
	const due = levy["due"]
	if (typeof due === "string" && !ids.has(due)) emit("UNKNOWN_MEASURE", [...path, "due"])
	const edges: Edge[][] = []
	for (let index = 0; index < measures.length; index++) {
		edges.push(edgesOf(measures[index], [...path, "measures", index], ids, emit))
	}
	reportCycles(edges, emit)
}
