import { addMonthsClamped } from "../calendar/arith"
import { isSafeInteger, overflow } from "../engine/overflow"
import { snapshot } from "../engine/snapshot"
import type { StateMap } from "../engine/state"
import type { DateString } from "../types"
import type { ProjectionProblem } from "../types/projection"
import { type ExpenseWindow, expenseBetween } from "./expenses"

export interface BufferBreach {
	readonly date: DateString
	readonly required: bigint
	readonly accessible: bigint
}

export type BufferOutcome =
	| { readonly kind: "ok" }
	| { readonly kind: "breach"; readonly breach: BufferBreach }
	| { readonly kind: "problem"; readonly problem: ProjectionProblem }

/** `ceil(minBufferMonths × E(D) / 12)`, in exact integer arithmetic. */
export function requiredBuffer(months: number, expenses: bigint): bigint {
	return (BigInt(months) * expenses + 11n) / 12n
}

/** Checks accessible net worth after `date`'s flows against a full twelve-month expense window. */
export function checkBuffer(
	states: StateMap,
	date: DateString,
	months: number,
	expenses: ExpenseWindow,
): BufferOutcome {
	const measured = expenseBetween(expenses, date, addMonthsClamped(date, 12))
	if (!isSafeInteger(measured)) return { kind: "problem", problem: overflow(date) }
	const required = requiredBuffer(months, measured)
	if (!isSafeInteger(required)) return { kind: "problem", problem: overflow(date) }
	const valued = snapshot(states, date)
	if (valued.problem !== undefined) return { kind: "problem", problem: valued.problem }
	const accessible = valued.snapshot!.accessibleNetWorth
	if (accessible < required) {
		return { kind: "breach", breach: { date, required, accessible } }
	}
	return { kind: "ok" }
}
