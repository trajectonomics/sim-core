import type { AccountId, DateString } from "../types"
import type { ProjectionProblem } from "../types/projection"
import { addTo } from "./add"
import type { LevySet } from "./levy-set"
import { addFlowTallies, addFundedTallies } from "./levy-tally"
import type { DayTotals } from "./occurrence"

export interface Settlement {
	readonly amount: bigint
	readonly problem: ProjectionProblem | undefined
}

interface DayParts {
	readonly income: bigint
	readonly expense: bigint
	readonly prepaid: bigint
}

export function mergeFunded(
	...maps: readonly ReadonlyMap<string, bigint>[]
): ReadonlyMap<string, bigint> {
	const funded = new Map<string, bigint>()
	for (const map of maps) for (const [label, amount] of map) addTo(funded, label, amount)
	return funded
}

export function tally(
	levies: LevySet | undefined,
	date: DateString,
	gross: ReadonlyMap<string, bigint>,
	funded: ReadonlyMap<string, bigint>,
	byLevy: ReadonlyMap<string, bigint>,
): void {
	if (levies === undefined) return
	addFlowTallies(levies, date, gross, byLevy)
	addFundedTallies(levies, date, funded)
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
