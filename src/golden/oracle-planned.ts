import type { Fixture } from "../fixtures/fixture"
import type { DateString, Derive, Flow } from "../types"
import { isDerived, isFixed } from "../types"
import { oracleCalendar } from "./oracle-calendar"
import { oracleDeriveValues } from "./oracle-derive"
import { type OracleEvent, oracleAmount, oracleEvents } from "./oracle-flow"

/** The Flow ids a Derived amount reads, in Measure order, from the raw graph. */
function flowReferences(derive: Derive): readonly string[] {
	const ids: string[] = []
	for (const measure of derive.measures) if (measure.op === "flow") ids.push(measure.flow)
	return ids
}

/** Every Flow's planned gross amount on one Landed date, fixed sums and Derived values. */
export type PlannedDay = ReadonlyMap<string, bigint>

/** Derived Flows in dependency order, then Flow id, from a naive depth-first walk. */
function ordered(flows: readonly Flow[]): readonly Flow[] {
	const byId = new Map<string, Flow>()
	for (const flow of flows) if (!byId.has(flow.id)) byId.set(flow.id, flow)
	const seen = new Set<string>()
	const out: Flow[] = []
	const visit = (flow: Flow): void => {
		if (!isDerived(flow) || seen.has(flow.id)) return
		seen.add(flow.id)
		for (const reference of flowReferences(flow.derive)) {
			const found = byId.get(reference)
			if (found !== undefined) visit(found)
		}
		out.push(flow)
	}
	for (const id of [...byId.keys()].sort()) visit(byId.get(id)!)
	return out
}

function plannedDay(
	events: readonly OracleEvent[],
	derivation: readonly Flow[],
	date: DateString,
	inflation: number,
): PlannedDay {
	const totals = new Map<string, bigint>()
	const counts = new Map<string, number>()
	for (const event of events) {
		counts.set(event.flow.id, (counts.get(event.flow.id) ?? 0) + 1)
		if (!isFixed(event.flow)) continue
		totals.set(event.flow.id, (totals.get(event.flow.id) ?? 0n) + oracleAmount(event, inflation))
	}
	for (const flow of derivation) {
		const count = BigInt(counts.get(flow.id) ?? 0)
		if (count === 0n || !isDerived(flow)) continue
		const read = (id: string): bigint => totals.get(id) ?? 0n
		const value = oracleDeriveValues(flow.derive, read, date, inflation)
		totals.set(flow.id, value * count)
	}
	return totals
}

/** The independent planner: every Landed date's planned gross amounts, before Prepayment. */
export function oraclePlanned(fixture: Fixture): ReadonlyMap<DateString, PlannedDay> {
	const { scenario, timeline } = fixture
	const inflation = scenario.economy.inflation
	const calendar = oracleCalendar(fixture)
	const events = oracleEvents(scenario.flows, timeline.start, timeline.horizon, calendar)
	const derivation = ordered(scenario.flows)
	const byDate = new Map<DateString, OracleEvent[]>()
	for (const event of events) {
		const day = byDate.get(event.date) ?? []
		day.push(event)
		byDate.set(event.date, day)
	}
	const planned = new Map<DateString, PlannedDay>()
	for (const [date, day] of byDate) planned.set(date, plannedDay(day, derivation, date, inflation))
	return planned
}
