import type { AccountId, DateString } from "../types"
import type { ProjectionProblem } from "../types/projection"
import type { Planned } from "./derive"
import type { DatedEvent } from "./events"
import { addIncome } from "./levy-prepaid"
import type { SettlementPeriodView } from "./levy-shares"

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
	/** Each Levy's own Prepayment share. */
	readonly prepaidByLevy: ReadonlyMap<string, bigint>
	/** A capped Prepayment read a cap that is not a safe integer. */
	readonly problem?: ProjectionProblem
}

interface Totals {
	income: bigint
	expense: bigint
	prepaid: bigint
	readonly gross: Map<string, bigint>
	readonly prepaidByLevy: Map<string, bigint>
	readonly contributionEntries: ContributionEntry[]
}

function takeIncome(
	totals: Totals,
	flow: Extract<DatedEvent["flow"], { kind: "income" }>,
	amount: bigint,
	views: readonly SettlementPeriodView[],
	date: DateString,
): ProjectionProblem | undefined {
	totals.income += amount
	const taken = addIncome(flow, amount, totals.gross, views, date)
	for (const [levy, share] of taken.byLevy) {
		totals.prepaidByLevy.set(levy, (totals.prepaidByLevy.get(levy) ?? 0n) + share)
	}
	totals.prepaid += taken.prepaid
	return taken.problem
}

/** Sums one Occurrence's flows, separating Prepayment and Tally labels from the cash amounts. */
export function aggregate(
	events: readonly DatedEvent[],
	planned: Planned,
	views: readonly SettlementPeriodView[],
	date: DateString,
): DayFlows {
	const totals: Totals = {
		income: 0n,
		expense: 0n,
		prepaid: 0n,
		gross: new Map(),
		prepaidByLevy: new Map(),
		contributionEntries: [],
	}
	for (const event of events) {
		const flow = event.flow
		const amount = event.amount ?? planned.derived.get(flow.id) ?? 0n
		if (flow.kind === "income") {
			const problem = takeIncome(totals, flow, amount, views, date)
			if (problem !== undefined) return { ...totals, problem }
		} else if (flow.kind === "expense") {
			totals.expense += amount
		} else {
			totals.contributionEntries.push({ target: flow.target, amount, label: flow.label })
		}
	}
	return totals
}
