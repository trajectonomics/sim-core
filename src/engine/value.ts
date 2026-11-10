import { countedDays } from "../calendar/counted"
import { grow } from "../money/growth"
import type { DateString } from "../types"
import { walkRows } from "./span"
import type { AccountState, StateMap } from "./state"

/** An Account's reported value, split into its capitalised and accrued parts. */
export interface ValueParts {
	readonly capitalised: bigint
	readonly accruedInterest: bigint
	readonly amount: bigint
}

/** Read-only valuation; it never commits the account. An effective Account is all capitalised. */
export function valueParts(state: AccountState, date: DateString): ValueParts {
	const series = state.series
	const amount =
		series === undefined
			? state.asOf === date
				? state.balance
				: grow(state.balance, state.rule.rate, countedDays(state.asOf, date))
			: walkRows(state.balance, state.asOf, date, series)
	return { capitalised: amount, accruedInterest: 0n, amount }
}

export function valuation(state: AccountState, date: DateString): bigint {
	return valueParts(state, date).amount
}

function signedValue(state: AccountState, date: DateString): bigint {
	const value = valuation(state, date)
	return state.rule.kind === "liability" ? -value : value
}

export function netWorth(states: StateMap, date: DateString): bigint {
	let total = 0n
	for (const state of states.values()) total += signedValue(state, date)
	return total
}

export function accessibleNetWorth(states: StateMap, date: DateString): bigint {
	let total = 0n
	for (const state of states.values()) {
		if (state.rule.kind === "liability") total -= valuation(state, date)
		else if (state.rule.lockedUntil === undefined || date >= state.rule.lockedUntil) {
			total += valuation(state, date)
		}
	}
	return total
}
