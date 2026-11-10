import { countedDays } from "../calendar/counted"
import { grow } from "../money/growth"
import type { DateString } from "../types"
import { walkRows } from "./span"
import type { AccountState, StateMap } from "./state"

/** Read-only valuation; it never commits the account. */
export function valuation(state: AccountState, date: DateString): bigint {
	const series = state.series
	if (series === undefined) {
		return grow(state.balance, state.rule.rate, countedDays(state.asOf, date))
	}
	return walkRows(state.balance, state.asOf, date, series)
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
