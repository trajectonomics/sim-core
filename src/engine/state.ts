import type { Account, AccountId, Baseline, DateString, Scenario } from "../types"
import { compareIds } from "./order"
import type { ResolvedReturns, ResolvedSeries } from "./returns"

/**
 * Growth already attributed to Settlement periods since the Account's last commit. The base is
 * `AccountState.balance`, measured at `AccountState.asOf`; a commit resets both.
 */
export interface ReturnLedger {
	readonly label: string
	/** Growth from the base already given to earlier Settlement periods. */
	attributed: bigint
	/** The last date attribution reached: a commit date after a reset, else a period boundary. */
	through: DateString
}

export interface AccountState {
	readonly rule: Account
	readonly series?: ResolvedSeries
	/** An effective Account's value, or a nominal Account's capitalised balance. */
	balance: bigint
	asOf: DateString
	/** A nominal Account's exact capitalised-days numerator; always 0 for an effective Account. */
	capitalisedDays: bigint
	/** Present only for an asset Account with `returnLabel`. */
	readonly returns?: ReturnLedger
	/** Pooled Cost basis, present only for an asset Account with `gainLabel`. */
	basis?: bigint
}

export type StateMap = ReadonlyMap<AccountId, AccountState>

function ledgerOf(rule: Account, start: DateString): ReturnLedger | undefined {
	if (rule.kind !== "asset" || rule.returnLabel === undefined) return undefined
	return { label: rule.returnLabel, attributed: 0n, through: start }
}

function basisOf(rule: Account, opening: ReadonlyMap<AccountId, number>): bigint | undefined {
	if (rule.kind !== "asset" || rule.gainLabel === undefined) return undefined
	return BigInt(opening.get(rule.id) ?? 0)
}

interface Opened {
	readonly rule: Account
	readonly amount: number
	readonly start: DateString
	readonly series: ResolvedSeries | undefined
	readonly basis: ReadonlyMap<AccountId, number>
}

function stateOf(opened: Opened): AccountState {
	const { rule, amount, start, series, basis } = opened
	const returns = ledgerOf(rule, start)
	const cost = basisOf(rule, basis)
	return {
		rule,
		balance: BigInt(amount),
		asOf: start,
		capitalisedDays: 0n,
		...(series === undefined ? {} : { series }),
		...(returns === undefined ? {} : { returns }),
		...(cost === undefined ? {} : { basis: cost }),
	}
}

/** Every declared account gets a state; missing baseline balances open at zero. */
export function createStates(
	baseline: Baseline,
	scenario: Scenario,
	start: DateString,
	series?: ResolvedReturns,
): StateMap {
	const opening = new Map<AccountId, number>()
	const basis = new Map<AccountId, number>()
	for (const balance of baseline.balances) {
		opening.set(balance.account, balance.amount)
		if (balance.basis !== undefined) basis.set(balance.account, balance.basis)
	}
	const states = new Map<AccountId, AccountState>()
	const rules = [...scenario.accounts].sort((a, b) => compareIds(a.id, b.id))
	for (const rule of rules) {
		states.set(
			rule.id,
			stateOf({
				rule,
				amount: opening.get(rule.id) ?? 0,
				start,
				series: series?.get(rule.id),
				basis,
			}),
		)
	}
	return states
}
