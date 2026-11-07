import type { Check } from "./codes"
import { measure } from "./measure"
import { checkGraph } from "./measure-graph"
import { monthDay } from "./month-day"
import { str } from "./scalars"
import { checkShape, checkUnique, list, req } from "./shape"

const shape = {
	id: req(str),
	period: req(monthDay),
	settlement: req(monthDay),
	measures: req(list(measure)),
	due: req(str),
}

export const checkLevy: Check = (value, path, emit) => {
	const levy = checkShape(value, path, shape, emit)
	if (!levy) return
	checkUnique(levy["measures"], [...path, "measures"], "id", emit)
	checkGraph(levy, path, emit)
}
