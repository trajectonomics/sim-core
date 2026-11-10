import {
	accrualDenominator,
	capitaliseThrough,
	commitThrough,
	interestOf,
	type NominalRule,
} from "../money/nominal"
import type { DateString } from "../types"
import type { ProjectionProblem } from "../types/projection"
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
) {
	state.balance = capitalised
	state.capitalisedDays = capitalisedDays
	state.asOf = date
}

/** Nominal commit: completed periods capitalise first, then the delta applies to capitalised. */
function nominalCommit(
	state: AccountState,
	rule: NominalRule,
	date: DateString,
	delta: bigint,
): ProjectionProblem | undefined {
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
		commit(state, next, running.capitalisedDays, date)
		return undefined
	}
	// An overdrawing debit capitalises the running period first, so the Account can be paid off.
	const accrued = interestOf(running.capitalisedDays, rule.rate, accrualDenominator(rule, date))
	const cleared = running.capitalised + accrued + delta
	if (cleared < 0n) throw negative(state.rule.id, date)
	if (!isSafeInteger(cleared)) return overflow(date, state.rule.id)
	commit(state, cleared, 0n, date)
	return undefined
}

/** Commits accrued growth, then applies `delta`; returns a problem on overflow. */
export function mutate(
	state: AccountState,
	date: DateString,
	delta: bigint,
): ProjectionProblem | undefined {
	const rule = activeNominalRule(state)
	if (rule !== undefined) return nominalCommit(state, rule, date, delta)
	const committed = valuation(state, date)
	if (!isSafeInteger(committed)) return overflow(date, state.rule.id)
	const next = committed + delta
	if (next < 0n) throw negative(state.rule.id, date)
	if (!isSafeInteger(next)) return overflow(date, state.rule.id)
	state.balance = next
	state.asOf = date
	return undefined
}
