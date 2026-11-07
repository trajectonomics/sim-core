import { isSafeInteger } from "../engine/overflow"
import type { Levy, LevyContext, MeasuresResult, Tallies } from "../types"
import { dependencyOrder } from "./order"
import { step } from "./step"
import { unsafeTally } from "./tallies"

/**
 * Evaluates every Measure of a Levy in exact BigInt arithmetic. `levy` must have passed `check()`;
 * `context.date` must be a valid ISO date and `context.inflation` a valid rate (both trusted).
 * A Measure whose exact value is not a safe integer yields `VALUE_OVERFLOW` at `context.date`
 * instead of a value; a tally a Measure reads that is not a safe integer yields `NOT_SAFE_INTEGER`
 * at `[basis, label]`. The result map follows the Levy's own Measure order.
 */
export function evaluateMeasures(
	levy: Levy,
	tallies: Tallies,
	context: LevyContext,
): MeasuresResult {
	const unsafe = unsafeTally(levy.measures, tallies)
	if (unsafe !== undefined) return { ok: false, problem: unsafe }
	const exact = new Map<string, bigint>()
	const get = (id: string): bigint => {
		const value = exact.get(id)
		if (value === undefined) throw new RangeError(`Measure ${id} is not evaluated before use`)
		return value
	}
	const order = dependencyOrder(levy.measures)
	for (let index = 0; index < order.length; index++) {
		const measure = order[index]
		if (measure === undefined) continue
		const value = step(measure, get, tallies, context)
		if (!isSafeInteger(value)) {
			return { ok: false, problem: { code: "VALUE_OVERFLOW", date: context.date } }
		}
		exact.set(measure.id, value)
	}
	const values = new Map<string, number>()
	for (let index = 0; index < levy.measures.length; index++) {
		const id = levy.measures[index]?.id
		if (id !== undefined) values.set(id, Number(get(id)))
	}
	return { ok: true, values, due: Number(get(levy.due)) }
}
