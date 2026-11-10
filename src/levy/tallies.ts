import type { InputProblem, Measure, Tallies } from "../types"

/** The first tally a Measure reads that is not a safe integer, as a problem at its path. */
export function unsafeTally(
	measures: readonly Measure[],
	tallies: Tallies,
): InputProblem | undefined {
	for (let index = 0; index < measures.length; index++) {
		const measure = measures[index]
		if (measure === undefined || measure.op !== "tally") continue
		const total = tallies[measure.basis]?.get(measure.label)
		if (total !== undefined && !Number.isSafeInteger(total)) {
			return { code: "NOT_SAFE_INTEGER", path: [measure.basis, measure.label] }
		}
	}
	return undefined
}
