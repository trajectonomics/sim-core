import type { BasisPoints, DateString, Levy, Tallies } from "../types"
import { type LevyPeriodPlan, periodIndexAt } from "./levy-plan"
import type { LevyTally, LevyTracker } from "./levy-types"

export function createTracker(
	levy: Levy,
	periods: readonly LevyPeriodPlan[],
	inflation: BasisPoints,
): LevyTracker {
	const tallies = periods.map(() => ({ gross: new Map(), funded: new Map(), prepaid: 0n }))
	const settlementIndex = new Map(periods.map((period) => [period.settlementDate, period.index]))
	return {
		levy,
		inflation,
		periods,
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
	return { gross: numberMap(tally.gross), funded: numberMap(tally.funded) }
}

function addTo(map: Map<string, bigint>, label: string, amount: bigint): void {
	map.set(label, (map.get(label) ?? 0n) + amount)
}

/** Adds one Occurrence's income labels and Prepayment to the period containing `date`. */
export function addFlowTallies(
	tracker: LevyTracker,
	date: DateString,
	gross: ReadonlyMap<string, bigint>,
	prepaid: bigint,
): void {
	const tally = tracker.tallies[periodIndexAt(tracker.periods, date)]
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
	const tally = tracker.tallies[periodIndexAt(tracker.periods, date)]
	if (tally === undefined) return
	for (const [label, amount] of funded) addTo(tally.funded, label, amount)
}

export function hasSettlement(tracker: LevyTracker, date: DateString): boolean {
	return tracker.settlementIndex.has(date)
}
