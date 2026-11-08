import type { AccountId, DateString } from "../types"
import type { ProjectionProblem } from "../types/projection"
import { addTo } from "./add"
import type { ContributionEntry } from "./aggregate"
import { minBigInt } from "./min"
import { mutate } from "./mutate"
import { compareIds } from "./order"
import type { StateMap } from "./state"
import { valuation } from "./value"

export interface ContributionResult {
	readonly outflow: bigint
	readonly funded: ReadonlyMap<string, bigint>
	readonly problem: ProjectionProblem | undefined
}

interface TargetResult {
	readonly outflow: bigint
	readonly funded: ReadonlyMap<string, bigint>
	readonly problem: ProjectionProblem | undefined
}

/** Splits the amount actually applied across the entries, in engine (date, id) order. */
function allocate(
	entries: readonly ContributionEntry[],
	payment: bigint,
): ReadonlyMap<string, bigint> {
	const funded = new Map<string, bigint>()
	let remaining = payment
	for (const entry of entries) {
		if (remaining === 0n) break
		const applied = minBigInt(entry.amount, remaining)
		remaining -= applied
		if (entry.label !== undefined && applied > 0n) addTo(funded, entry.label, applied)
	}
	return funded
}

function group(entries: readonly ContributionEntry[]): ReadonlyMap<AccountId, ContributionEntry[]> {
	const groups = new Map<AccountId, ContributionEntry[]>()
	for (const entry of entries) {
		const found = groups.get(entry.target)
		if (found === undefined) groups.set(entry.target, [entry])
		else found.push(entry)
	}
	return groups
}

function totalOf(entries: readonly ContributionEntry[]): bigint {
	let total = 0n
	for (const entry of entries) total += entry.amount
	return total
}

/**
 * Applies one target's same-date contributions. Asset targets are not yet capped by Available
 * cashflow (#18); funded tallies already follow the amount actually applied, so that cap will
 * carry into them without a tally change.
 */
function applyTarget(
	states: StateMap,
	target: AccountId,
	entries: readonly ContributionEntry[],
	date: DateString,
): TargetResult {
	const total = totalOf(entries)
	const state = states.get(target)
	if (total === 0n || state === undefined) {
		return { outflow: 0n, funded: new Map(), problem: undefined }
	}
	const liability = state.rule.kind === "liability"
	const owed = liability ? valuation(state, date) : total
	const payment = minBigInt(total, owed)
	const problem = mutate(state, date, liability ? -payment : payment)
	if (problem !== undefined) return { outflow: 0n, funded: new Map(), problem }
	return { outflow: payment, funded: allocate(entries, payment), problem: undefined }
}

/** Applies same-date contributions per target, capping liability payments at the amount owed. */
export function applyContributions(
	states: StateMap,
	entries: readonly ContributionEntry[],
	date: DateString,
): ContributionResult {
	const groups = group(entries)
	let outflow = 0n
	const funded = new Map<string, bigint>()
	for (const target of [...groups.keys()].sort(compareIds)) {
		const result = applyTarget(states, target, groups.get(target) ?? [], date)
		if (result.problem !== undefined) return { outflow, funded, problem: result.problem }
		outflow += result.outflow
		for (const [label, amount] of result.funded) addTo(funded, label, amount)
	}
	return { outflow, funded, problem: undefined }
}
