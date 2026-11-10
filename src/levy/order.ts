import type { Measure } from "../types"
import { operandsOf } from "./refs"

/**
 * Measures in dependency order: every Measure comes after the ones it reads. Needs a Levy that
 * `check()` accepted (unique ids, known operands, no cycle); for any other input the order is
 * still finite but a Measure may precede its operands.
 */
export function dependencyOrder<T extends Measure>(measures: readonly T[]): readonly T[] {
	// Index loops throughout: `check()` walks arrays by index, so this must see the same Measures.
	const byId = new Map<string, T>()
	for (let index = 0; index < measures.length; index++) {
		const measure = measures[index]
		if (measure !== undefined) byId.set(measure.id, measure)
	}
	const seen = new Set<string>()
	const ordered: T[] = []
	const visit = (measure: T): void => {
		if (seen.has(measure.id)) return
		seen.add(measure.id)
		for (const operand of operandsOf(measure)) {
			const found = byId.get(operand)
			if (found !== undefined) visit(found)
		}
		ordered.push(measure)
	}
	for (let index = 0; index < measures.length; index++) {
		const measure = measures[index]
		if (measure !== undefined) visit(measure)
	}
	return ordered
}
