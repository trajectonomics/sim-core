import type { DateString } from "../types"
import { addTo } from "./add"
import { settlementPeriodIndexAt } from "./levy-plan"
import type { LevyTracker } from "./levy-types"
import type { AccountState, ReturnLedger, StateMap } from "./state"
import { valuation } from "./value"

/**
 * Adds the growth since the ledger's base, measured from that one base, to the Settlement
 * period containing `date`; `date` at or before the ledger's mark is already attributed.
 */
function attribute(
	state: AccountState,
	tracker: LevyTracker,
	ledger: ReturnLedger,
	date: DateString,
): void {
	const id = tracker.levy.id
	if (date <= (ledger.through.get(id) ?? ledger.since)) return
	const index = settlementPeriodIndexAt(tracker.periods, date)
	const tally = tracker.tallies[index]
	if (index < 0 || tally === undefined) return
	const declared = ledger.attributed.get(id) ?? 0n
	const growth = valuation(state, date) - ledger.base - declared
	addTo(tally.returns, ledger.label, growth)
	ledger.attributed.set(id, declared + growth)
	ledger.through.set(id, date)
}

/** Attributes each period end the range crosses, splitting there, then the rest at `date`. */
function attributeThrough(
	state: AccountState,
	tracker: LevyTracker,
	ledger: ReturnLedger,
	date: DateString,
): void {
	const last = settlementPeriodIndexAt(tracker.periods, date)
	for (
		let index = settlementPeriodIndexAt(
			tracker.periods,
			ledger.through.get(tracker.levy.id) ?? ledger.since,
		);
		index <= last;
		index++
	) {
		const period = tracker.periods[index]
		if (period !== undefined && period.to <= date) attribute(state, tracker, ledger, period.to)
	}
	attribute(state, tracker, ledger, date)
}

/** Moves the ledger's base to the value right after the commit that just happened. */
export function rebaseReturns(state: AccountState, date: DateString): void {
	const ledger = state.returns
	if (ledger === undefined) return
	ledger.base = valuation(state, date)
}

/** Splits a commit's growth at every period end it crosses, then attributes the rest. */
export function commitReturns(state: AccountState, tracker: LevyTracker, date: DateString): void {
	const ledger = state.returns
	if (ledger === undefined) return
	attributeThrough(state, tracker, ledger, date)
	ledger.attributed.set(tracker.levy.id, 0n)
}

/**
 * Closes every period end through `through` for each Account that tracks returns, without
 * committing. Called before any read at a date, so a nominal Account's own capitalisation can
 * never move its clock past a boundary that has not been attributed.
 */
export function closeReturns(states: StateMap, tracker: LevyTracker, through: DateString): void {
	for (const state of states.values()) {
		const ledger = state.returns
		if (ledger !== undefined) attributeThrough(state, tracker, ledger, through)
	}
}
