import { addMonthsClamped } from "../calendar/arith"
import { isSafeInteger, overflow } from "../engine/overflow"
import type { DateString } from "../types"
import type { ProjectionProblem } from "../types/projection"
import { expenseBetween, type Measured, type WindowOutcome } from "./expenses"

export type Requirement =
	| { readonly kind: "ok"; readonly required: bigint }
	| { readonly kind: "problem"; readonly problem: ProjectionProblem }

export interface RequirementTable {
	readonly expenses: WindowOutcome
	readonly months: number
	readonly cache: Map<DateString, Requirement>
}

/** `ceil(months × E(D) / 12)`, exact, memoised per date because it depends only on the date. */
export function requirementTable(expenses: WindowOutcome, months: number): RequirementTable {
	return { expenses, months, cache: new Map() }
}

function measure(table: RequirementTable, date: DateString): Measured {
	return expenseBetween(table.expenses, date, addMonthsClamped(date, 12))
}

/** The Minimum buffer `required(D)` for one date, or why the measurement cannot be reported. */
export function requirement(table: RequirementTable, date: DateString): Requirement {
	const cached = table.cache.get(date)
	if (cached !== undefined) return cached
	const measured = measure(table, date)
	if (measured.kind === "problem") return measured
	if (!isSafeInteger(measured.amount)) return { kind: "problem", problem: overflow(date) }
	const required = (BigInt(table.months) * measured.amount + 11n) / 12n
	if (!isSafeInteger(required)) return { kind: "problem", problem: overflow(date) }
	const value: Requirement = { kind: "ok", required }
	table.cache.set(date, value)
	return value
}
