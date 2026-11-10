import type { BasisPoints, DateString, Flow, Levy, Tallies } from "../types"
import { addTo } from "./add"
import { capTables } from "./levy-cap"
import { type SettlementPeriodPlan, settlementPeriodIndexAt } from "./levy-plan"
import type { LevyTally, LevyTracker } from "./levy-types"

/** Seeds only periods that began before `start`; a record for a period starting on `start` cannot be Carry-in. */
function applyCarryIn(
	tallies: readonly LevyTally[],
	periods: readonly SettlementPeriodPlan[],
	levy: Levy,
	start: DateString,
): void {
	const byStart = new Map(periods.map((period, index) => [period.from, index] as const))
	for (const record of levy.carryIn ?? []) {
		const index = byStart.get(record.periodStart)
		const tally = index === undefined ? undefined : tallies[index]
		if (index === undefined || tally === undefined || periods[index]!.from >= start) continue
		for (const item of record.tallies) addTo(tally[item.basis], item.label, BigInt(item.amount))
		tally.prepaid += BigInt(record.prepaid)
	}
}

export function createTracker(
	levy: Levy,
	flows: readonly Flow[],
	periods: readonly SettlementPeriodPlan[],
	inflation: BasisPoints,
	start: DateString,
): LevyTracker {
	const tallies = periods.map(() => ({
		gross: new Map(),
		funded: new Map(),
		returns: new Map(),
		gains: new Map(),
		prepaid: 0n,
	}))
	const settlementIndex = new Map(periods.map((period) => [period.settlementDate, period.index]))
	applyCarryIn(tallies, periods, levy, start)
	return {
		levy,
		inflation,
		periods,
		caps: capTables(levy, flows, periods, inflation),
		tallies,
		results: periods.map(() => undefined),
		settlementIndex,
	}
}

function numberMap(map: ReadonlyMap<string, bigint>): Map<string, number> {
	const numbers = new Map<string, number>()
	for (const [label, amount] of map) numbers.set(label, Number(amount))
	return numbers
}

/** The evaluator's number-based view of one period's bigint tallies. */
export function talliesOf(tally: LevyTally): Tallies {
	return {
		gross: numberMap(tally.gross),
		funded: numberMap(tally.funded),
		returns: numberMap(tally.returns),
		gains: numberMap(tally.gains),
	}
}

/** Adds one Occurrence's income labels and Prepayment to the period containing `date`. */
export function addFlowTallies(
	tracker: LevyTracker,
	date: DateString,
	gross: ReadonlyMap<string, bigint>,
	prepaid: bigint,
): void {
	const tally = tracker.tallies[settlementPeriodIndexAt(tracker.periods, date)]
	if (tally === undefined) return
	for (const [label, amount] of gross) addTo(tally.gross, label, amount)
	tally.prepaid += prepaid
}

/** Adds the contribution amounts actually applied on `date` to that period's funded tallies. */
export function addFundedTallies(
	tracker: LevyTracker,
	date: DateString,
	funded: ReadonlyMap<string, bigint>,
): void {
	const tally = tracker.tallies[settlementPeriodIndexAt(tracker.periods, date)]
	if (tally === undefined) return
	for (const [label, amount] of funded) addTo(tally.funded, label, amount)
}

export function hasSettlement(tracker: LevyTracker, date: DateString): boolean {
	return tracker.settlementIndex.has(date)
}
