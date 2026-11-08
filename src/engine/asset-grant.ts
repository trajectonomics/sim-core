import type { AccountId, DateString } from "../types"
import type { ProjectionProblem } from "../types/projection"
import type { ContributionEntry } from "./aggregate"
import { appliedByLabel, plannedTotal } from "./contribution-entries"
import { minBigInt } from "./min"
import { mutate } from "./mutate"
import type { StateMap } from "./state"

export interface Grant {
	readonly applied: bigint
	readonly funded: ReadonlyMap<string, bigint>
	readonly unfunded: bigint
	readonly problem: ProjectionProblem | undefined
}

/** Grants one asset target up to `remaining`, never touching the account on a zero grant. */
export function grantAsset(
	states: StateMap,
	target: AccountId,
	entries: readonly ContributionEntry[],
	remaining: bigint,
	date: DateString,
): Grant {
	const planned = plannedTotal(entries)
	const granted = minBigInt(planned, remaining)
	const state = states.get(target)
	if (granted === 0n || state === undefined) {
		return { applied: 0n, funded: new Map(), unfunded: planned, problem: undefined }
	}
	const problem = mutate(state, date, granted)
	if (problem !== undefined) {
		return { applied: 0n, funded: new Map(), unfunded: planned, problem }
	}
	return {
		applied: granted,
		funded: appliedByLabel(entries, granted),
		unfunded: planned - granted,
		problem: undefined,
	}
}
