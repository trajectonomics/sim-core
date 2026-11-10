import type { AccountId, DateString } from "../types"
import type { ProjectionProblem } from "../types/projection"
import { isSafeInteger, overflow } from "./overflow"
import type { StateMap } from "./state"
import { valueParts } from "./value"

export interface EngineBalance {
	readonly account: AccountId
	readonly amount: bigint
	readonly capitalised: bigint
	readonly accruedInterest: bigint
}

export interface EngineSnapshot {
	readonly date: DateString
	readonly balances: readonly EngineBalance[]
	readonly netWorth: bigint
	readonly accessibleNetWorth: bigint
}

export interface SnapshotOutcome {
	readonly snapshot: EngineSnapshot | undefined
	readonly problem: ProjectionProblem | undefined
}

/** Values every account without committing, and checks all reported numbers stay safe. */
export function snapshot(states: StateMap, date: DateString): SnapshotOutcome {
	const balances: EngineBalance[] = []
	let net = 0n
	let accessible = 0n
	for (const state of states.values()) {
		const parts = valueParts(state, date)
		if (!isSafeInteger(parts.amount))
			return { snapshot: undefined, problem: overflow(date, state.rule.id) }
		balances.push({ account: state.rule.id, ...parts })
		const signed = state.rule.kind === "liability" ? -parts.amount : parts.amount
		net += signed
		const unlocked =
			state.rule.kind === "liability" ||
			state.rule.lockedUntil === undefined ||
			date >= state.rule.lockedUntil
		if (unlocked) accessible += signed
	}
	if (!isSafeInteger(net) || !isSafeInteger(accessible)) {
		return { snapshot: undefined, problem: overflow(date) }
	}
	return {
		snapshot: { date, balances, netWorth: net, accessibleNetWorth: accessible },
		problem: undefined,
	}
}
