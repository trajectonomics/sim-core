import type { EngineSettlementPeriod, LevyTally, LevyTracker } from "../engine/levy-types"
import type { AccountState, StateMap } from "../engine/state"

export function cloneStates(states: StateMap): StateMap {
	const cloned = new Map<string, AccountState>()
	for (const [id, state] of states) {
		cloned.set(id, { rule: state.rule, balance: state.balance, asOf: state.asOf })
	}
	return cloned
}

function cloneTally(tally: LevyTally): LevyTally {
	return { gross: new Map(tally.gross), funded: new Map(tally.funded), prepaid: tally.prepaid }
}

function clonePeriod(
	period: EngineSettlementPeriod | undefined,
): EngineSettlementPeriod | undefined {
	if (period === undefined) return undefined
	return { ...period, measures: period.measures.map((measure) => ({ ...measure })) }
}

/** A deep-enough copy to continue a candidate without touching the baseline prefix. */
export function cloneTracker(tracker: LevyTracker | undefined): LevyTracker | undefined {
	if (tracker === undefined) return undefined
	return {
		...tracker,
		tallies: tracker.tallies.map(cloneTally),
		results: tracker.results.map(clonePeriod),
	}
}
