import { snapshot } from "../engine/snapshot"
import type { StateMap } from "../engine/state"
import type { DateString } from "../types"
import type { ProjectionProblem } from "../types/projection"
import { type RequirementTable, requirement } from "./required"

export interface BufferBreach {
	readonly date: DateString
	readonly required: bigint
	readonly accessible: bigint
}

export type BufferOutcome =
	| { readonly kind: "ok" }
	| { readonly kind: "breach"; readonly breach: BufferBreach }
	| { readonly kind: "problem"; readonly problem: ProjectionProblem }

/** Checks accessible net worth after `date`'s flows against a full twelve-month expense window. */
export function checkBuffer(
	states: StateMap,
	date: DateString,
	table: RequirementTable,
): BufferOutcome {
	const needed = requirement(table, date)
	if (needed.kind === "problem") return needed
	const valued = snapshot(states, date)
	if (valued.problem !== undefined) return { kind: "problem", problem: valued.problem }
	const accessible = valued.snapshot!.accessibleNetWorth
	if (accessible < needed.required) {
		return { kind: "breach", breach: { date, required: needed.required, accessible } }
	}
	return { kind: "ok" }
}
