import type { DateString } from "../types"
import type { ProjectionProblem } from "../types/projection"

export interface ExpenseWindow {
	readonly dates: readonly DateString[]
	readonly cumulative: readonly bigint[]
}

export type WindowOutcome =
	| { readonly ok: true; readonly window: ExpenseWindow }
	| { readonly ok: false; readonly problem: ProjectionProblem }

export type Measured =
	| { readonly kind: "ok"; readonly amount: bigint }
	| { readonly kind: "problem"; readonly problem: ProjectionProblem }

interface Measurement {
	readonly date: DateString
	readonly amount: bigint
}

/** Date-ordered cumulative sums, which is all an interval sum needs. */
export function buildWindow(measurements: readonly Measurement[]): ExpenseWindow {
	const sorted = [...measurements].sort((left, right) =>
		left.date < right.date ? -1 : left.date > right.date ? 1 : 0,
	)
	const dates = sorted.map((measurement) => measurement.date)
	const cumulative: bigint[] = [0n]
	for (const measurement of sorted) {
		cumulative.push(cumulative[cumulative.length - 1]! + measurement.amount)
	}
	return { dates, cumulative }
}

function lowerBound(dates: readonly DateString[], target: DateString): number {
	let low = 0
	let high = dates.length
	while (low < high) {
		const middle = Math.floor((low + high) / 2)
		if (dates[middle]! < target) low = middle + 1
		else high = middle
	}
	return low
}

/** Sum of measurement amounts in `[from, toExclusive)`, or why the window could not be built. */
export function expenseBetween(
	outcome: WindowOutcome,
	from: DateString,
	toExclusive: DateString,
): Measured {
	if (!outcome.ok) return { kind: "problem", problem: outcome.problem }
	const { dates, cumulative } = outcome.window
	const low = lowerBound(dates, from)
	const high = lowerBound(dates, toExclusive)
	return { kind: "ok", amount: cumulative[high]! - cumulative[low]! }
}
