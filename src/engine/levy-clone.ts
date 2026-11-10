import type { LevySet } from "./levy-set"
import type { EngineSettlementPeriod, LevyTally, LevyTracker } from "./levy-types"
import type { AccountState, StateMap } from "./state"

/** A copy of every Account's state, deep enough for a candidate to diverge from its prefix. */
export function cloneStates(states: StateMap): StateMap {
	const cloned = new Map<string, AccountState>()
	for (const [id, state] of states) {
		cloned.set(id, {
			...state,
			...(state.returns === undefined
				? {}
				: {
						returns: {
							...state.returns,
							attributed: new Map(state.returns.attributed),
							through: new Map(state.returns.through),
						},
					}),
		})
	}
	return cloned
}

function cloneTally(tally: LevyTally): LevyTally {
	return {
		gross: new Map(tally.gross),
		funded: new Map(tally.funded),
		returns: new Map(tally.returns),
		gains: new Map(tally.gains),
		prepaid: tally.prepaid,
	}
}

function cloneSettlementPeriod(
	settlement: EngineSettlementPeriod | undefined,
): EngineSettlementPeriod | undefined {
	if (settlement === undefined) return undefined
	return { ...settlement, measures: settlement.measures.map((measure) => ({ ...measure })) }
}

function cloneTracker(tracker: LevyTracker): LevyTracker {
	return {
		...tracker,
		tallies: tracker.tallies.map(cloneTally),
		results: tracker.results.map(cloneSettlementPeriod),
	}
}

/** A deep-enough copy to continue a candidate without touching the baseline prefix. */
export function cloneLevySet(levies: LevySet | undefined): LevySet | undefined {
	if (levies === undefined) return undefined
	return { trackers: levies.trackers.map(cloneTracker) }
}
