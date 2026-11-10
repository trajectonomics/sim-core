import { roundHalfUp } from "../money/round"
import type { DateString } from "../types"
import { addTo } from "./add"
import { settlementPeriodIndexAt } from "./levy-plan"
import type { LevyTracker } from "./levy-types"
import type { AccountState } from "./state"

/** The share of pooled basis a withdrawal uses, rounded half up and never above the basis. */
function basisTaken(basis: bigint, withdrawn: bigint, valueBefore: bigint): bigint {
	if (basis === 0n || valueBefore === 0n) return 0n
	const share = roundHalfUp(basis * withdrawn, valueBefore)
	return share > basis ? basis : share
}

function labelOf(state: AccountState): string | undefined {
	return state.rule.kind === "asset" ? state.rule.gainLabel : undefined
}

/**
 * Books one commit against a gain-tracked Account's pooled basis. Money entering adds basis;
 * growth never does; a withdrawal realises `withdrawn − basis taken` in the period of `date`.
 */
export function commitGains(
	state: AccountState,
	tracker: LevyTracker,
	date: DateString,
	delta: bigint,
	valueBefore: bigint,
): void {
	const label = labelOf(state)
	if (state.basis === undefined || label === undefined || delta === 0n) return
	if (delta > 0n) {
		state.basis += delta
		return
	}
	const withdrawn = -delta
	const taken = basisTaken(state.basis, withdrawn, valueBefore)
	state.basis -= taken
	const index = settlementPeriodIndexAt(tracker.periods, date)
	const tally = tracker.tallies[index]
	if (tally !== undefined) addTo(tally.gains, label, withdrawn - taken)
}
