import type { AccountId, DateString } from "../types"
import type { ProjectionProblem } from "../types/projection"
import { addTo } from "./add"
import type { ContributionEntry } from "./aggregate"
import { grantAsset } from "./asset-grant"
import { appliedByLabel, groupEntries, plannedTotal } from "./contribution-entries"
import { minBigInt } from "./min"
import { mutate } from "./mutate"
import { compareIds } from "./order"
import type { StateMap } from "./state"
import { valuation } from "./value"

export interface DebtResult {
	readonly paid: bigint
	readonly funded: ReadonlyMap<string, bigint>
	readonly problem: ProjectionProblem | undefined
}

export interface AssetResult {
	readonly applied: bigint
	readonly funded: ReadonlyMap<string, bigint>
	readonly unfunded: ReadonlyMap<AccountId, bigint>
	readonly problem: ProjectionProblem | undefined
}

const NOTHING: DebtResult = { paid: 0n, funded: new Map(), problem: undefined }

function applyDebtTarget(
	states: StateMap,
	target: AccountId,
	entries: readonly ContributionEntry[],
	date: DateString,
): DebtResult {
	const state = states.get(target)
	const planned = plannedTotal(entries)
	if (state?.rule.kind !== "liability" || planned === 0n) return NOTHING
	const payment = minBigInt(planned, valuation(state, date))
	if (payment === 0n) return NOTHING
	const problem = mutate(state, date, -payment)
	if (problem !== undefined) return { paid: 0n, funded: new Map(), problem }
	return { paid: payment, funded: appliedByLabel(entries, payment), problem: undefined }
}

/** Liability payments are obligations: each pays `min(planned, owed)`, in account-id order. */
export function applyDebt(
	states: StateMap,
	entries: readonly ContributionEntry[],
	date: DateString,
): DebtResult {
	const groups = groupEntries(entries)
	let paid = 0n
	const funded = new Map<string, bigint>()
	for (const target of [...groups.keys()].sort(compareIds)) {
		const result = applyDebtTarget(states, target, groups.get(target) ?? [], date)
		if (result.problem !== undefined) return { paid, funded, problem: result.problem }
		paid += result.paid
		for (const [label, amount] of result.funded) addTo(funded, label, amount)
	}
	return { paid, funded, problem: undefined }
}

/**
 * Asset contributions spend only `available` cashflow, in `contribute` priority order. The part
 * that does not fit is reported as unfunded and dropped; a zero grant never touches an account.
 */
export function applyAssets(
	states: StateMap,
	contribute: readonly AccountId[],
	entries: readonly ContributionEntry[],
	available: bigint,
	date: DateString,
): AssetResult {
	const groups = groupEntries(entries)
	let remaining = available
	let applied = 0n
	const funded = new Map<string, bigint>()
	const unfunded = new Map<AccountId, bigint>()
	for (const target of contribute) {
		const targetEntries = groups.get(target) ?? []
		if (plannedTotal(targetEntries) === 0n) continue
		const grant = grantAsset(states, target, targetEntries, remaining, date)
		if (grant.problem !== undefined) {
			return { applied, funded, unfunded, problem: grant.problem }
		}
		if (grant.unfunded > 0n) unfunded.set(target, grant.unfunded)
		remaining -= grant.applied
		applied += grant.applied
		for (const [label, amount] of grant.funded) addTo(funded, label, amount)
	}
	return { applied, funded, unfunded, problem: undefined }
}
