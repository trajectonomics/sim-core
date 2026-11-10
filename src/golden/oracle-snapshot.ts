import type { AccountId, DateString } from "../types"
import { oracleCountedDays } from "./oracle-date"
import { oracleDeflate } from "./oracle-money"
import { type OracleStates, oracleValueParts } from "./oracle-state"

/** A flow amount: no split, so it is not a row balance. */
export interface OracleBalance {
	readonly account: AccountId
	readonly amount: bigint
}

/** A row balance, split into its capitalised and accrued parts. */
export interface OracleRowBalance extends OracleBalance {
	readonly capitalised: bigint
	readonly accruedInterest: bigint
}

export interface OracleSnapshot {
	readonly date: DateString
	readonly balances: readonly OracleRowBalance[]
	readonly netWorth: bigint
	readonly accessibleNetWorth: bigint
	readonly realBalances: readonly OracleRowBalance[]
	readonly realNetWorth: bigint
	readonly realAccessibleNetWorth: bigint
}

function realRow(balance: OracleRowBalance, inflation: number, days: number): OracleRowBalance {
	const capitalised = oracleDeflate(balance.capitalised, inflation, days)
	const accruedInterest = oracleDeflate(balance.accruedInterest, inflation, days)
	return {
		account: balance.account,
		amount: capitalised + accruedInterest,
		capitalised,
		accruedInterest,
	}
}

export function oracleSnapshot(
	states: OracleStates,
	date: DateString,
	start: DateString,
	inflation: number,
): OracleSnapshot {
	const days = oracleCountedDays(start, date)
	const balances: OracleRowBalance[] = []
	const realBalances: OracleRowBalance[] = []
	let net = 0n
	let accessible = 0n
	let realNet = 0n
	let realAccessible = 0n
	const ordered = [...states.values()].sort((a, b) => (a.rule.id < b.rule.id ? -1 : 1))
	for (const state of ordered) {
		const parts = oracleValueParts(state, date)
		const balance = { account: state.rule.id, ...parts }
		const real = realRow(balance, inflation, days)
		balances.push(balance)
		realBalances.push(real)
		const signed = state.rule.kind === "liability" ? -parts.amount : parts.amount
		const realSigned = state.rule.kind === "liability" ? -real.amount : real.amount
		net += signed
		realNet += realSigned
		const unlocked =
			state.rule.kind !== "asset" ||
			state.rule.lockedUntil === undefined ||
			date >= state.rule.lockedUntil
		if (unlocked) {
			accessible += signed
			realAccessible += realSigned
		}
	}
	return {
		date,
		balances,
		netWorth: net,
		accessibleNetWorth: accessible,
		realBalances,
		realNetWorth: realNet,
		realAccessibleNetWorth: realAccessible,
	}
}
