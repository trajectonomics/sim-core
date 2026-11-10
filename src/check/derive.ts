import type { Check } from "./codes"
import { DERIVE_RULES, measure } from "./measure"
import { checkRefs } from "./measure-graph"
import { str } from "./scalars"
import { checkShape, checkUnique, list, req } from "./shape"

const shape = {
	measures: req(list(measure(DERIVE_RULES))),
	result: req(str),
}

/** One Flow's Derived amount: a Measure graph with ids local to the Flow and the result's id. */
export const derive: Check = (value, path, emit) => {
	const found = checkShape(value, path, shape, emit)
	if (!found) return
	checkUnique(found["measures"], [...path, "measures"], "id", emit)
	checkRefs(found["measures"], found["result"], "result", path, emit)
}
