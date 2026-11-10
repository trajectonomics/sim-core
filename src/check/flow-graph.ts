import type { Emit, Path } from "./codes"
import { isRecord } from "./shape"

interface Edge {
	readonly to: number
	readonly path: Path
}

function indexIds(flows: readonly unknown[]): Map<string, number> {
	const ids = new Map<string, number>()
	for (let index = 0; index < flows.length; index++) {
		const item: unknown = flows[index]
		const id = isRecord(item) ? item["id"] : undefined
		if (typeof id === "string" && !ids.has(id)) ids.set(id, index)
	}
	return ids
}

/** A `flow` op of a Flow's `derive`, which reads another Flow by id. */
interface FlowRef {
	readonly flow: unknown
	readonly path: Path
}

function refsOf(flow: unknown, at: Path): readonly FlowRef[] {
	if (!isRecord(flow)) return []
	const derive = flow["derive"]
	if (!isRecord(derive)) return []
	const measures = derive["measures"]
	if (!Array.isArray(measures)) return []
	const refs: FlowRef[] = []
	for (let index = 0; index < measures.length; index++) {
		const measure: unknown = measures[index]
		if (!isRecord(measure) || measure["op"] !== "flow") continue
		refs.push({ flow: measure["flow"], path: [...at, "derive", "measures", index, "flow"] })
	}
	return refs
}

/** One edge per `flow` reference; a reference to an unknown Flow is reported instead. */
function edgesOf(
	flow: unknown,
	index: number,
	ids: Map<string, number>,
	path: Path,
	emit: Emit,
): readonly Edge[] {
	const edges: Edge[] = []
	for (const ref of refsOf(flow, [...path, index])) {
		const to = typeof ref.flow === "string" ? ids.get(ref.flow) : undefined
		if (to !== undefined) edges.push({ to, path: ref.path })
		else if (typeof ref.flow === "string") emit("UNKNOWN_FLOW", ref.path)
	}
	return edges
}

/** Depth-first walk over Flow ids; an edge back to a Flow still being visited closes a cycle. */
function reportCycles(edges: readonly (readonly Edge[])[], emit: Emit): void {
	const state = new Array<0 | 1 | 2>(edges.length).fill(0)
	const visit = (index: number): void => {
		state[index] = 1
		for (const edge of edges[index] ?? []) {
			if (state[edge.to] === 1) emit("FLOW_CYCLE", edge.path)
			else if (state[edge.to] === 0) visit(edge.to)
		}
		state[index] = 2
	}
	for (let index = 0; index < edges.length; index++) if (state[index] === 0) visit(index)
}

/** Reports unknown Flow references in a `derive` graph and cycles among the Flows. */
export function checkFlowGraph(flows: unknown, path: Path, emit: Emit): void {
	if (!Array.isArray(flows)) return
	const ids = indexIds(flows)
	const edges: Edge[][] = []
	for (let index = 0; index < flows.length; index++) {
		edges.push([...edgesOf(flows[index], index, ids, path, emit)])
	}
	reportCycles(edges, emit)
}
