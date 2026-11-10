import type { AccountId, DateString } from "../types"
import type { ProjectionProblem } from "../types/projection"
import { addTo } from "./add"
import { settleAt } from "./levy-settle"
import { addFlowTallies, addFundedTallies } from "./levy-tally"
import type { LevyTracker } from "./levy-types"
import type { DayTotals } from "./occurrence"
import type { StateMap } from "./state"

export interface Settlement {
	readonly amount: bigint
	readonly problem: ProjectionProblem | undefined
}

interface DayParts {
	readonly income: bigint
	readonly expense: bigint
	readonly prepaid: bigint
}

export function settlementOn(
	tracker: LevyTracker | undefined,
	states: StateMap,
	date: DateString,
): Settlement {
	if (tracker === undefined) return { amount: 0n, problem: undefined }
	const outcome = settleAt(tracker, states, date)
	return { amount: outcome.settlement, problem: outcome.problem }
}

export function mergeFunded(
	...maps: readonly ReadonlyMap<string, bigint>[]
): ReadonlyMap<string, bigint> {
	const funded = new Map<string, bigint>()
	for (const map of maps) for (const [label, amount] of map) addTo(funded, label, amount)
	return funded
}

export function tally(
	tracker: LevyTracker | undefined,
	date: DateString,
	gross: ReadonlyMap<string, bigint>,
	funded: ReadonlyMap<string, bigint>,
	prepaid: bigint,
): void {
	if (tracker === undefined) return
	addFlowTallies(tracker, date, gross, prepaid)
	addFundedTallies(tracker, date, funded)
}

export function totalsOf(
	date: DateString,
	day: DayParts,
	contributions: bigint,
	unfunded: ReadonlyMap<AccountId, bigint>,
	settlement: Settlement,
): DayTotals {
	return {
		date,
		income: day.income,
		expense: day.expense,
		contributions,
		unfunded,
		levy: day.prepaid + settlement.amount,
	}
}
