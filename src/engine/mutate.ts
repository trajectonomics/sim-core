import {
	accrualDenominator,
	capitaliseThrough,
	commitThrough,
	interestOf,
	type NominalRule,
} from "../money/nominal"
import type { DateString } from "../types"
import type { ProjectionProblem } from "../types/projection"
import { commitGains } from "./levy-gains"
import { commitReturns, rebaseReturns } from "./levy-returns"
import type { LevyTracker } from "./levy-types"
import { isSafeInteger, overflow } from "./overflow"
import type { AccountState } from "./state"
import { activeNominalRule, valuation } from "./value"

function negative(id: string, date: DateString): RangeError {
	return new RangeError(`Negative balance on ${id} at ${date}`)
}

function commit(
	state: AccountState,
	capitalised: bigint,
	capitalisedDays: bigint,
	date: DateString,
	tracker: LevyTracker | undefined,
) {
	state.balance = capitalised
	state.capitalisedDays = capitalisedDays
	state.asOf = date
	if (tracker !== undefined) rebaseReturns(state, date)
}

/** Nominal commit: completed periods capitalise first, then the delta applies to capitalised. */
function nominalCommit(
	state: AccountState,
	rule: NominalRule,
	date: DateString,
	delta: bigint,
	tracker: LevyTracker | undefined,
): ProjectionProblem | undefined {
	const valueBefore = valuation(state, date)
	if (tracker !== undefined) {
		commitReturns(state, tracker, date)
		commitGains(state, tracker, date, delta, valueBefore)
	}
	const settled = capitaliseThrough(
		{ capitalised: state.balance, capitalisedDays: state.capitalisedDays, asOf: state.asOf },
		rule,
		date,
	)
	if (!isSafeInteger(settled.capitalised)) return overflow(date, state.rule.id)
	const running = commitThrough(settled, date)
	const next = running.capitalised + delta
	if (next >= 0n) {
		if (!isSafeInteger(next)) return overflow(date, state.rule.id)
		commit(state, next, running.capitalisedDays, date, tracker)
		return undefined
	}
	// An overdrawing debit capitalises the running period first, so the Account can be paid off.
	const accrued = interestOf(running.capitalisedDays, rule.rate, accrualDenominator(rule, date))
	const cleared = running.capitalised + accrued + delta
	if (cleared < 0n) throw negative(state.rule.id, date)
	if (!isSafeInteger(cleared)) return overflow(date, state.rule.id)
	commit(state, cleared, 0n, date, tracker)
	return undefined
}

/**
 * Commits accrued growth, then applies `delta`; returns a problem on overflow. The commit books
 * the tallies the change produces (returns attribution, later realised gains) before moving.
 */
export function mutate(
	state: AccountState,
	date: DateString,
	delta: bigint,
	tracker: LevyTracker | undefined,
): ProjectionProblem | undefined {
	const rule = activeNominalRule(state)
	if (rule !== undefined) return nominalCommit(state, rule, date, delta, tracker)
	const committed = valuation(state, date)
	if (!isSafeInteger(committed)) return overflow(date, state.rule.id)
	const next = committed + delta
	if (next < 0n) throw negative(state.rule.id, date)
	if (!isSafeInteger(next)) return overflow(date, state.rule.id)
	if (tracker !== undefined) {
		commitReturns(state, tracker, date)
		commitGains(state, tracker, date, delta, committed)
	}
	state.balance = next
	state.asOf = date
	if (tracker !== undefined) rebaseReturns(state, date)
	return undefined
}
