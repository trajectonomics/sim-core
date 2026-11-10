import type { Check, Emit, Path } from "./codes"
import { isValidDate } from "./date"
import { checkFlowGraph } from "./flow-graph"
import { type FlowContext, flowShape } from "./flow-shape"

export type { FlowContext }

import { checkShape, checkUnique, isRecord, list } from "./shape"

/** ISO dates compare correctly as strings once validated. */
function checkDates(flow: Readonly<Record<string, unknown>>, path: Path, emit: Emit): void {
	const { start, end, frequency } = flow
	if (!isValidDate(start) || !isValidDate(end)) return
	if (end < start) emit("END_BEFORE_START", [...path, "end"])
	else if (frequency === "once" && end !== start) emit("ONCE_FLOW_END_MISMATCH", [...path, "end"])
}

/** Exactly one of `amount` (which needs `growth`) and `derive`, and no `growth` on a derived Flow. */
function checkAmount(flow: Readonly<Record<string, unknown>>, path: Path, emit: Emit): void {
	const hasAmount = Object.hasOwn(flow, "amount")
	const hasDerive = Object.hasOwn(flow, "derive")
	const hasGrowth = Object.hasOwn(flow, "growth")
	if (hasAmount && hasDerive) emit("FIELD_NOT_ALLOWED", [...path, "derive"])
	if (!hasAmount && !hasDerive) emit("MISSING_KEY", [...path, "amount"])
	if (hasAmount && !hasGrowth) emit("MISSING_KEY", [...path, "growth"])
	if (!hasAmount && hasDerive && hasGrowth) emit("FIELD_NOT_ALLOWED", [...path, "growth"])
}

function flowCheck(context: FlowContext): Check {
	return (value, path, emit) => {
		const kind = isRecord(value) ? value["kind"] : undefined
		const flow = checkShape(value, path, flowShape(kind, context), emit)
		if (!flow) return
		checkDates(flow, path, emit)
		checkAmount(flow, path, emit)
	}
}

export function checkFlows(value: unknown, path: Path, context: FlowContext, emit: Emit): void {
	list(flowCheck(context))(value, path, emit)
	checkUnique(value, path, "id", emit)
	checkFlowGraph(value, path, emit)
}
