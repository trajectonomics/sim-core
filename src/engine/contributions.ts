import type { AccountId, DateString } from "../types"
import type { ProjectionProblem } from "../types/projection"
import { minBigInt } from "./min"
import { mutate } from "./mutate"
import { compareIds } from "./order"
import type { StateMap } from "./state"
import { valuation } from "./value"

export interface DebtResult {
	readonly paid: bigint
	readonly problem: ProjectionProblem | undefined
}

export interface AssetResult {
	readonly applied: bigint
	readonly unfunded: ReadonlyMap<AccountId, bigint>
	readonly problem: ProjectionProblem | undefined
}

/** Liability payments are obligations: each pays `min(planned, owed)`, in account-id order. */
export function applyDebt(
	states: StateMap,
	contributions: ReadonlyMap<AccountId, bigint>,
	date: DateString,
): DebtResult {
	let paid = 0n
	for (const target of [...contributions.keys()].sort(compareIds)) {
		const state = states.get(target)
		const planned = contributions.get(target) ?? 0n
		if (state?.rule.kind !== "liability" || planned === 0n) continue
		const payment = minBigInt(planned, valuation(state, date))
		if (payment === 0n) continue
		const problem = mutate(state, date, -payment)
		if (problem !== undefined) return { paid, problem }
		paid += payment
	}
	return { paid, problem: undefined }
}

interface Grant {
	readonly applied: bigint
	readonly unfunded: bigint
	readonly problem: ProjectionProblem | undefined
}

function grantAsset(
	states: StateMap,
	target: AccountId,
	planned: bigint,
	remaining: bigint,
	date: DateString,
): Grant {
	const granted = minBigInt(planned, remaining)
	const state = states.get(target)
	if (granted === 0n || state === undefined) {
		return { applied: 0n, unfunded: planned, problem: undefined }
	}
	const problem = mutate(state, date, granted)
	if (problem !== undefined) return { applied: 0n, unfunded: planned, problem }
	return { applied: granted, unfunded: planned - granted, problem: undefined }
}

/**
 * Asset contributions spend only `available` cashflow, in `contribute` priority order. The part
 * that does not fit is reported as unfunded and dropped; a zero grant never touches an account.
 */
export function applyAssets(
	states: StateMap,
	contribute: readonly AccountId[],
	contributions: ReadonlyMap<AccountId, bigint>,
	available: bigint,
	date: DateString,
): AssetResult {
	let remaining = available
	let applied = 0n
	const unfunded = new Map<AccountId, bigint>()
	for (const target of contribute) {
		const planned = contributions.get(target) ?? 0n
		if (planned === 0n) continue
		const grant = grantAsset(states, target, planned, remaining, date)
		if (grant.problem !== undefined) return { applied, unfunded, problem: grant.problem }
		if (grant.unfunded > 0n) unfunded.set(target, grant.unfunded)
		remaining -= grant.applied
		applied += grant.applied
	}
	return { applied, unfunded, problem: undefined }
}
