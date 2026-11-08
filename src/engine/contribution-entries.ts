import type { AccountId } from "../types"
import { addTo } from "./add"
import type { ContributionEntry } from "./aggregate"
import { minBigInt } from "./min"

export function groupEntries(
	entries: readonly ContributionEntry[],
): ReadonlyMap<AccountId, readonly ContributionEntry[]> {
	const groups = new Map<AccountId, ContributionEntry[]>()
	for (const entry of entries) {
		const found = groups.get(entry.target)
		if (found === undefined) groups.set(entry.target, [entry])
		else found.push(entry)
	}
	return groups
}

export function plannedTotal(entries: readonly ContributionEntry[]): bigint {
	let total = 0n
	for (const entry of entries) total += entry.amount
	return total
}

/** Splits the amount actually applied across entries, in engine (date, id) order. */
export function appliedByLabel(
	entries: readonly ContributionEntry[],
	applied: bigint,
): ReadonlyMap<string, bigint> {
	const funded = new Map<string, bigint>()
	let remaining = applied
	for (const entry of entries) {
		if (remaining === 0n) break
		const amount = minBigInt(entry.amount, remaining)
		remaining -= amount
		if (entry.label !== undefined && amount > 0n) addTo(funded, entry.label, amount)
	}
	return funded
}
