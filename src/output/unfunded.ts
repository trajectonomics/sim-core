import type { DayTotals } from "../engine/occurrence"
import { compareIds } from "../engine/order"
import { isSafeInteger, overflow } from "../engine/overflow"
import type { AccountId, DateString } from "../types"
import type { AccountAmount, ProjectionProblem } from "../types/projection"

export interface UnfundedOutcome {
	readonly amounts: readonly AccountAmount[] | undefined
	readonly problem: ProjectionProblem | undefined
}

/** Totals dropped asset contributions per account, omitting zero rows and sorting by id. */
export function buildUnfunded(totals: readonly DayTotals[], end: DateString): UnfundedOutcome {
	const sums = new Map<AccountId, bigint>()
	for (const total of totals) {
		for (const [account, amount] of total.unfunded) {
			sums.set(account, (sums.get(account) ?? 0n) + amount)
		}
	}
	const amounts: AccountAmount[] = []
	for (const account of [...sums.keys()].sort(compareIds)) {
		const amount = sums.get(account) ?? 0n
		if (!isSafeInteger(amount)) return { amounts: undefined, problem: overflow(end) }
		if (amount !== 0n) amounts.push({ account, amount: Number(amount) })
	}
	return { amounts, problem: undefined }
}
