import type { Check } from "./codes"
import { carryIn, checkCarryInRecords } from "./levy-carry-in"
import { LEVY_RULES, measure } from "./measure"
import { checkGraph } from "./measure-graph"
import { monthDay } from "./month-day"
import { str } from "./scalars"
import { checkShape, checkUnique, list, opt, req } from "./shape"

const shape = {
	id: req(str),
	period: req(monthDay),
	settlement: req(monthDay),
	measures: req(list(measure(LEVY_RULES))),
	due: req(str),
	carryIn: opt(carryIn),
}

export const checkLevy: Check = (value, path, emit) => {
	const levy = checkShape(value, path, shape, emit)
	if (!levy) return
	checkUnique(levy["measures"], [...path, "measures"], "id", emit)
	checkGraph(levy, path, emit)
	checkCarryInRecords(levy, path, emit)
}

/** A Scenario's Levies: an optional, non-empty array with unique ids. */
export const checkLevies: Check = (value, path, emit) => {
	list(checkLevy)(value, path, emit)
	if (Array.isArray(value) && value.length === 0) emit("MISSING_KEY", path)
	checkUnique(value, path, "id", emit)
}
