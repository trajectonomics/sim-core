import type { Account, AccountId, DateString } from "../types"
import { oracleCountedDays } from "./oracle-date"
import { oracleGrow } from "./oracle-money"
import {
	type OracleNominalRule,
	type OracleValueParts,
	oracleNominalParts,
	oracleNominalRule,
	oracleWalk,
} from "./oracle-nominal"

export type { OracleValueParts } from "./oracle-nominal"

export interface OracleState {
	readonly rule: Account
	balance: bigint
	asOf: DateString
	/** A nominal Account's capitalised-days numerator; always 0 for an effective Account. */
	accrued: bigint
}

export type OracleStates = ReadonlyMap<AccountId, OracleState>

/** An effective-annual Account's value is all capitalised. */
export function oracleValueParts(state: OracleState, date: DateString): OracleValueParts {
	const rule = oracleNominalRule(state.rule)
	if (rule === undefined) {
		const amount = oracleGrow(state.balance, state.rule.rate, oracleCountedDays(state.asOf, date))
		return { capitalised: amount, accruedInterest: 0n, amount }
	}
	return oracleNominalParts(
		{ capitalised: state.balance, numerator: state.accrued, asOf: state.asOf },
		rule,
		date,
	)
}

export function oracleValuation(state: OracleState, date: DateString): bigint {
	return oracleValueParts(state, date).amount
}

function accrueRunning(accrual: ReturnType<typeof oracleWalk>, rule: OracleNominalRule): bigint {
	if (accrual.numerator === 0n) return 0n
	return oracleNominalParts(accrual, rule, accrual.asOf).accruedInterest
}

/** Commits the accrual through `date`, then applies `delta` with the capitalised-first debit rule. */
export function oracleMutate(state: OracleState, date: DateString, delta: bigint): void {
	const rule = oracleNominalRule(state.rule)
	if (rule === undefined) {
		state.balance = oracleValuation(state, date) + delta
		state.asOf = date
		return
	}
	const walked = oracleWalk(
		{ capitalised: state.balance, numerator: state.accrued, asOf: state.asOf },
		rule,
		date,
	)
	const owed = -delta
	if (delta >= 0n || owed <= walked.capitalised) {
		state.balance = walked.capitalised + delta
		state.accrued = walked.numerator
	} else {
		state.balance = walked.capitalised + accrueRunning(walked, rule) + delta
		state.accrued = 0n
	}
	state.asOf = date
}
