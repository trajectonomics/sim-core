import type { DateString } from "../types"
import type { ProjectionProblem } from "../types/projection"
import { settlementPeriodIndexAt } from "./levy-plan"
import { closeReturns } from "./levy-returns"
import { settleAt } from "./levy-settle"
import type { SettlementPeriodView } from "./levy-shares"
import type { LevyTracker } from "./levy-types"
import type { StateMap } from "./state"

/** Every Levy's tracker, in Scenario Levy order; the engine knows nothing else about their number. */
export interface LevySet {
	readonly trackers: readonly LevyTracker[]
}

export interface Settlement {
	readonly amount: bigint
	readonly problem: ProjectionProblem | undefined
}

/** Every Levy's Settlement falling on or before `horizon`, in Scenario order. */
export function allSettlementDates(set: LevySet, horizon: DateString): readonly DateString[] {
	const dates: DateString[] = []
	for (const tracker of set.trackers) {
		for (const period of tracker.periods) {
			if (period.settlementDate <= horizon) dates.push(period.settlementDate)
		}
	}
	return dates
}

export function hasSettlement(set: LevySet, date: DateString): boolean {
	for (const tracker of set.trackers) if (tracker.settlementIndex.has(date)) return true
	return false
}

/** The period state of every Levy at `date`, in Scenario Levy order. */
export function settlementPeriodViews(
	set: LevySet,
	date: DateString,
): readonly SettlementPeriodView[] {
	return set.trackers.map((tracker) => {
		const index = settlementPeriodIndexAt(tracker.periods, date)
		if (index < 0) return { levy: tracker.levy.id, tally: undefined, caps: undefined }
		return { levy: tracker.levy.id, tally: tracker.tallies[index], caps: tracker.caps[index] }
	})
}

/** Settlements of every Levy on `date`, summed into the one signed movement cash sees. */
export function settlementOn(set: LevySet, states: StateMap, date: DateString): Settlement {
	let amount = 0n
	for (const tracker of set.trackers) {
		const outcome = settleAt(tracker, states, date)
		if (outcome.problem !== undefined) return { amount: 0n, problem: outcome.problem }
		amount += outcome.settlement
	}
	return { amount, problem: undefined }
}

export function closeReturnsOn(set: LevySet, states: StateMap, date: DateString): void {
	for (const tracker of set.trackers) closeReturns(states, tracker, date)
}
