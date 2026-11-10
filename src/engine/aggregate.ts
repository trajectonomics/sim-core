import type { AccountId, BasisPoints, DateString } from "../types"
import type { ProjectionProblem } from "../types/projection"
import { amountAt } from "./amount"
import type { DatedEvent } from "./events"
import { addIncome, settlementPeriodView } from "./levy-prepaid"
import type { LevyTracker } from "./levy-types"

export interface ContributionEntry {
	readonly target: AccountId
	readonly amount: bigint
	readonly label: string | undefined
}

export interface DayFlows {
	/** Planned gross income before Prepayment. */
	readonly income: bigint
	readonly expense: bigint
	readonly contributionEntries: readonly ContributionEntry[]
	/** Planned gross income by Tally label. */
	readonly gross: ReadonlyMap<string, bigint>
	readonly prepaid: bigint
	/** A capped Prepayment read a cap that is not a safe integer. */
	readonly capProblem?: ProjectionProblem
}

/** Sums one Occurrence's flows, separating Prepayment and Tally labels from the cash amounts. */
export function aggregate(
	events: readonly DatedEvent[],
	inflation: BasisPoints,
	date: DateString,
	tracker: LevyTracker | undefined,
): DayFlows {
	let income = 0n
	let expense = 0n
	let prepaid = 0n
	const gross = new Map<string, bigint>()
	const contributionEntries: ContributionEntry[] = []
	const view = settlementPeriodView(tracker, date)
	for (const event of events) {
		const amount = event.amount ?? amountAt(event, inflation)
		const flow = event.flow
		if (flow.kind === "income") {
			income += amount
			const taken = addIncome(flow, amount, gross, view, date)
			if (taken.problem !== undefined) {
				return { income, expense, contributionEntries, gross, prepaid, capProblem: taken.problem }
			}
			prepaid += taken.prepaid
		} else if (flow.kind === "expense") {
			expense += amount
		} else {
			contributionEntries.push({ target: flow.target, amount, label: flow.label })
		}
	}
	return { income, expense, contributionEntries, gross, prepaid }
}
