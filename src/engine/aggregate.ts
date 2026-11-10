import { roundHalfUp } from "../money/round"
import type { AccountId, BasisPoints, IncomeFlow } from "../types"
import { addTo } from "./add"
import { amountAt } from "./amount"
import type { DatedEvent } from "./events"

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
}

function prepaidAmount(amount: bigint, bps: number): bigint {
	return roundHalfUp(amount * BigInt(bps), 10_000n)
}

/** Adds a labeled income amount to the gross tallies and returns its Prepayment. */
function addIncome(flow: IncomeFlow, amount: bigint, gross: Map<string, bigint>): bigint {
	if (flow.label !== undefined) addTo(gross, flow.label, amount)
	if (flow.prepaymentBps === undefined) return 0n
	return prepaidAmount(amount, flow.prepaymentBps)
}

/** Sums one Occurrence's flows, separating Prepayment and Tally labels from the cash amounts. */
export function aggregate(events: readonly DatedEvent[], inflation: BasisPoints): DayFlows {
	let income = 0n
	let expense = 0n
	let prepaid = 0n
	const gross = new Map<string, bigint>()
	const contributionEntries: ContributionEntry[] = []
	for (const event of events) {
		const amount = event.amount ?? amountAt(event, inflation)
		const flow = event.flow
		if (flow.kind === "income") {
			income += amount
			prepaid += addIncome(flow, amount, gross)
		} else if (flow.kind === "expense") {
			expense += amount
		} else {
			contributionEntries.push({ target: flow.target, amount, label: flow.label })
		}
	}
	return { income, expense, contributionEntries, gross, prepaid }
}
