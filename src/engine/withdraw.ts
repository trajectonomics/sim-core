import type { DateString, Scenario } from "../types"
import type { ProjectionProblem } from "../types/projection"
import type { LevySet } from "./levy-set"
import { minBigInt } from "./min"
import { mutate } from "./mutate"
import type { AccountState, StateMap } from "./state"
import { valuation } from "./value"

export interface WithdrawResult {
	readonly remaining: bigint
	readonly problem: ProjectionProblem | undefined
}

function isLocked(state: AccountState, date: DateString): boolean {
	return (
		state.rule.kind === "asset" &&
		state.rule.lockedUntil !== undefined &&
		date < state.rule.lockedUntil
	)
}

function takeFrom(
	state: AccountState,
	date: DateString,
	remaining: bigint,
	levies: LevySet | undefined,
): WithdrawResult {
	const value = valuation(state, date)
	const take = minBigInt(remaining, value)
	if (take === 0n) return { remaining, problem: undefined }
	const problem = mutate(state, date, -take, levies)
	return problem === undefined
		? { remaining: remaining - take, problem: undefined }
		: { remaining, problem }
}

export function applyWithdraw(
	states: StateMap,
	scenario: Scenario,
	date: DateString,
	amount: bigint,
	levies: LevySet | undefined,
): WithdrawResult {
	let remaining = amount
	for (const account of scenario.cashflow.withdraw) {
		if (remaining === 0n) break
		const state = states.get(account)!
		if (isLocked(state, date)) continue
		const result = takeFrom(state, date, remaining, levies)
		remaining = result.remaining
		if (result.problem !== undefined) return result
	}
	return { remaining, problem: undefined }
}
