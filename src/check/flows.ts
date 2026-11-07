import type { AccountIndex, Check, Emit, Path } from "./codes"
import { isValidDate } from "./date"
import { flowShape } from "./flow-shape"
import { checkShape, checkUnique, isRecord, list } from "./shape"

/** ISO dates compare correctly as strings once validated. */
function checkDates(flow: Readonly<Record<string, unknown>>, path: Path, emit: Emit): void {
	const { start, end, frequency } = flow
	if (!isValidDate(start) || !isValidDate(end)) return
	if (end < start) emit("END_BEFORE_START", [...path, "end"])
	else if (frequency === "once" && end !== start) emit("ONCE_FLOW_END_MISMATCH", [...path, "end"])
}

function flowCheck(accounts: AccountIndex | undefined, hasLevy: boolean): Check {
	return (value, path, emit) => {
		const kind = isRecord(value) ? value["kind"] : undefined
		const flow = checkShape(value, path, flowShape(kind, accounts, hasLevy), emit)
		if (flow) checkDates(flow, path, emit)
	}
}

export function checkFlows(
	value: unknown,
	path: Path,
	accounts: AccountIndex | undefined,
	emit: Emit,
	hasLevy: boolean,
): void {
	list(flowCheck(accounts, hasLevy))(value, path, emit)
	checkUnique(value, path, "id", emit)
}
