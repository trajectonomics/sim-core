import { countedDays } from "../calendar/counted"
import { grow } from "../money/growth"
import { accrualParts, capitaliseThrough, type NominalRule } from "../money/nominal"
import type { Account, DateString } from "../types"
import { walkRows } from "./span"
import type { AccountState, StateMap } from "./state"

/** An Account's reported value, split into its capitalised and accrued parts. */
export interface ValueParts {
	readonly capitalised: bigint
	readonly accruedInterest: bigint
	readonly amount: bigint
}

/** The nominal rule of an Account, or `undefined` when its rate is effective annual. */
export function nominalRule(rule: Account): NominalRule | undefined {
	return rule.compounding === undefined
		? undefined
		: { rate: rule.rate, compounding: rule.compounding }
}

/** A Return series replaces the rate, so an Account holding one takes this path. */
function effectiveParts(state: AccountState, date: DateString): ValueParts {
	const series = state.series
	const amount =
		series === undefined
			? state.asOf === date
				? state.balance
				: grow(state.balance, state.rule.rate, countedDays(state.asOf, date))
			: walkRows(state.balance, state.asOf, date, series)
	return { capitalised: amount, accruedInterest: 0n, amount }
}

/**
 * Read-only for the running period: it never commits the partial interest it reports. It does
 * commit completed capitalisations, which are result-neutral and keep a read on a long gap linear.
 */
export function valueParts(state: AccountState, date: DateString): ValueParts {
	const rule = state.series === undefined ? nominalRule(state.rule) : undefined
	if (rule === undefined) return effectiveParts(state, date)
	const settled = capitaliseThrough(
		{ capitalised: state.balance, capitalisedDays: state.capitalisedDays, asOf: state.asOf },
		rule,
		date,
	)
	state.balance = settled.capitalised
	state.capitalisedDays = settled.capitalisedDays
	state.asOf = settled.asOf
	return accrualParts(settled, rule, date)
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
