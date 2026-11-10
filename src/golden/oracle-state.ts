import type { Account, AccountId, DateString } from "../types"
import { oracleCountedDays } from "./oracle-date"
import { oracleGrow } from "./oracle-money"

export interface OracleState {
	readonly rule: Account
	balance: bigint
	asOf: DateString
}

export type OracleStates = ReadonlyMap<AccountId, OracleState>

export interface OracleValueParts {
	readonly capitalised: bigint
	readonly accruedInterest: bigint
	readonly amount: bigint
}

/** An effective-annual Account's value is all capitalised; the nominal walk arrives with #59. */
export function oracleValueParts(state: OracleState, date: DateString): OracleValueParts {
	const amount = oracleGrow(state.balance, state.rule.rate, oracleCountedDays(state.asOf, date))
	return { capitalised: amount, accruedInterest: 0n, amount }
}

export function oracleValuation(state: OracleState, date: DateString): bigint {
	return oracleValueParts(state, date).amount
}

export function oracleMutate(state: OracleState, date: DateString, delta: bigint): void {
	state.balance = oracleValuation(state, date) + delta
	state.asOf = date
}
