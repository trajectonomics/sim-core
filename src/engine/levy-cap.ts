import { constantValue } from "../levy/step"
import type { ConstMeasure, Flow, Levy } from "../types"
import type { SettlementPeriodPlan } from "./levy-plan"

/** Exact cap value by Flow id for one Settlement period; never mutated after the tracker is built. */
export type CapTable = ReadonlyMap<string, bigint>

interface CappedFlow {
	readonly id: string
	readonly upTo: ConstMeasure
}

/** The Levy's `const` Measures by id, which are the only Measures a cap may name. */
function constsOf(levy: Levy): ReadonlyMap<string, ConstMeasure> {
	const consts = new Map<string, ConstMeasure>()
	for (const measure of levy.measures) {
		if (measure.op === "const") consts.set(measure.id, measure)
	}
	return consts
}

function cappedFlows(levy: Levy, flows: readonly Flow[]): readonly CappedFlow[] {
	const consts = constsOf(levy)
	const capped: CappedFlow[] = []
	for (const flow of flows) {
		if (flow.kind !== "income") continue
		const cappedBy = flow.cappedPrepayment
		if (cappedBy === undefined || cappedBy.levy !== levy.id) continue
		const upTo = consts.get(cappedBy.upTo)
		if (upTo !== undefined) capped.push({ id: flow.id, upTo })
	}
	return capped
}

/**
 * The `upTo` cap of every capped income Flow, evaluated once per Settlement period in that
 * period's own context (its Due date, as `due` is) so Prepayment and `due` share one number.
 * The value is stored exactly; the safe-integer range is checked only where an Occurrence reads it.
 */
export function capTables(
	levy: Levy,
	flows: readonly Flow[],
	periods: readonly SettlementPeriodPlan[],
	inflation: number,
): readonly CapTable[] {
	const capped = cappedFlows(levy, flows)
	return periods.map((period) => {
		const table = new Map<string, bigint>()
		// A Dated constant reads its step at the period's last day, as the period's `due` does.
		const context = { date: period.dueSettlementDate, periodEnd: period.to, inflation }
		for (const flow of capped) table.set(flow.id, constantValue(flow.upTo, context))
		return table
	})
}
