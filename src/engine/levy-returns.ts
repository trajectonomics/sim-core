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
	if (date <= ledger.through) return
	const index = settlementPeriodIndexAt(tracker.periods, date)
	const tally = tracker.tallies[index]
	if (index < 0 || tally === undefined) return
	const growth = valuation(state, date) - state.balance - ledger.attributed
	addTo(tally.returns, ledger.label, growth)
	ledger.attributed += growth
	ledger.through = date
}

/** Splits a commit's growth at every period end it crosses, then attributes the rest. */
export function commitReturns(state: AccountState, tracker: LevyTracker, date: DateString): void {
	const ledger = state.returns
	if (ledger === undefined) return
	const last = settlementPeriodIndexAt(tracker.periods, date)
	for (
		let index = settlementPeriodIndexAt(tracker.periods, ledger.through);
		index < last;
		index++
	) {
		const period = tracker.periods[index]
		if (period !== undefined) attribute(state, tracker, ledger, period.to)
	}
	attribute(state, tracker, ledger, date)
	ledger.attributed = 0n
}

/** Closes the open period at `through` for every Account that tracks returns, without committing. */
export function closeReturns(states: StateMap, tracker: LevyTracker, through: DateString): void {
	for (const state of states.values()) {
		const ledger = state.returns
		if (ledger !== undefined) attribute(state, tracker, ledger, through)
	}
}
