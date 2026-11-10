import type { Path } from "../check/codes"
import { evaluateDerive } from "../levy/derive"
import { flowRefsOf } from "../levy/refs"
import type { BasisPoints, DateString, Derive, Flow } from "../types"
import { isDerived, isFixed } from "../types"
import type { ProjectionProblem } from "../types/projection"
import { fixedAmountAt } from "./amount"
import type { DatedEvent } from "./events"
import { compareIds } from "./order"

export interface DerivedEntry {
	readonly id: string
	readonly derive: Derive
	/** Path of the Flow's `derive`, for a negative result. */
	readonly path: Path
}

/** Index of each Flow id by its first declaration. */
function indexFlows(flows: readonly Flow[]): ReadonlyMap<string, number> {
	const index = new Map<string, number>()
	for (let position = 0; position < flows.length; position++) {
		const flow = flows[position]
		if (flow !== undefined && !index.has(flow.id)) index.set(flow.id, position)
	}
	return index
}

/** Derived Flows in dependency order, then Flow id. Empty when nothing derives. */
export function derivedOrder(flows: readonly Flow[]): readonly DerivedEntry[] {
	const index = indexFlows(flows)
	const seen = new Set<string>()
	const entries: DerivedEntry[] = []
	const visit = (id: string): void => {
		if (seen.has(id)) return
		const position = index.get(id)
		const flow = position === undefined ? undefined : flows[position]
		if (flow === undefined || !isDerived(flow)) return
		seen.add(id)
		for (const reference of flowRefsOf(flow.derive)) visit(reference)
		entries.push({ id, derive: flow.derive, path: ["scenario", "flows", position!, "derive"] })
	}
	for (const id of [...index.keys()].sort(compareIds)) visit(id)
	return entries
}

/** One date's planned gross amounts: `totals` per Flow id, and a Derived Flow's amount per event. */
export interface Planned {
	readonly totals: ReadonlyMap<string, bigint>
	readonly derived: ReadonlyMap<string, bigint>
}

export type PlannedOutcome =
	| { readonly ok: true; readonly planned: Planned }
	| { readonly ok: false; readonly problem: ProjectionProblem }

function occurred(events: readonly DatedEvent[]): Map<string, number> {
	const counts = new Map<string, number>()
	for (const event of events) counts.set(event.flow.id, (counts.get(event.flow.id) ?? 0) + 1)
	return counts
}

function fixedTotals(events: readonly DatedEvent[], inflation: BasisPoints): Map<string, bigint> {
	const totals = new Map<string, bigint>()
	for (const event of events) {
		if (!isFixed(event.flow)) continue
		const amount = event.amount ?? fixedAmountAt(event.flow, event.years, inflation)
		totals.set(event.flow.id, (totals.get(event.flow.id) ?? 0n) + amount)
	}
	return totals
}

/**
 * Every Flow's planned gross amount on one Landed date, before Prepayment and any cap: a fixed
 * Flow sums its events, a Derived Flow evaluates once per date and each of its events gets it.
 */
export function plannedAmounts(
	events: readonly DatedEvent[],
	flows: readonly Flow[],
	date: DateString,
	inflation: BasisPoints,
): PlannedOutcome {
	const totals = fixedTotals(events, inflation)
	const order = derivedOrder(flows)
	if (order.length === 0) return { ok: true, planned: { totals, derived: new Map() } }
	const counts = occurred(events)
	const derived = new Map<string, bigint>()
	for (const entry of order) {
		const count = counts.get(entry.id) ?? 0
		if (count === 0) continue
		const outcome = evaluateDerive(entry.derive, {
			date,
			inflation,
			path: entry.path,
			read: (id) => totals.get(id) ?? 0n,
		})
		if (!outcome.ok) return { ok: false, problem: outcome.problem }
		derived.set(entry.id, outcome.amount)
		totals.set(entry.id, outcome.amount * BigInt(count))
	}
	return { ok: true, planned: { totals, derived } }
}
