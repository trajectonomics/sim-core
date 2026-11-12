import { countedDays } from "../calendar/counted"
import { isSafeInteger, overflow } from "../engine/overflow"
import type { StateMap } from "../engine/state"
import { valuation } from "../engine/value"
import { deflate } from "../money/growth"
import type { DateString } from "../types"
import type { Account } from "../types/account"
import type { ProjectionProblem } from "../types/projection"
import type { ReferenceBasis } from "../types/reference"
import type { ReferenceMoney } from "./reference-window"

export interface ReferenceSums {
	readonly unlockedAssets: bigint
	readonly numerator: bigint
}

export type ReferenceSumsOutcome = ReferenceSums | ProjectionProblem

interface Part {
	readonly counted: boolean
	readonly counts: boolean
	readonly liability: boolean
}

function included(basis: ReferenceBasis, liability: boolean, locked: boolean): boolean {
	if (basis === "netWorth") return true
	if (basis === "allAssets") return !liability
	if (basis === "accessibleNetWorth") return !locked
	return !liability && !locked
}

function partOf(rule: Account, date: DateString, basis: ReferenceBasis): Part {
	const liability = rule.kind === "liability"
	const locked = !liability && rule.lockedUntil !== undefined && date < rule.lockedUntil
	return { counted: !liability && !locked, counts: included(basis, liability, locked), liability }
}

function amountIn(value: bigint, date: DateString, money: ReferenceMoney): bigint {
	return money.real ? deflate(value, money.inflation, countedDays(money.start, date)) : value
}

function add(totals: { unlockedAssets: bigint; numerator: bigint }, part: Part, value: bigint) {
	if (part.counted) totals.unlockedAssets += value
	if (part.counts) totals.numerator += part.liability ? -value : value
}

/** The unlocked-asset sum and the configured numerator, both in the reference's money. */
export function referenceSums(
	states: StateMap,
	date: DateString,
	basis: ReferenceBasis,
	money: ReferenceMoney,
): ReferenceSumsOutcome {
	const totals = { unlockedAssets: 0n, numerator: 0n }
	for (const state of states.values()) {
		const part = partOf(state.rule, date, basis)
		if (!part.counted && !part.counts) continue
		const value = amountIn(valuation(state, date), date, money)
		if (!isSafeInteger(value)) return overflow(date, state.rule.id)
		add(totals, part, value)
	}
	if (!isSafeInteger(totals.unlockedAssets) || !isSafeInteger(totals.numerator)) {
		return overflow(date)
	}
	return totals
}
