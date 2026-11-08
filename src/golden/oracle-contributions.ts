import type { AccountId, DateString, Scenario } from "../types"
import { type OracleEvent, oracleAmount } from "./oracle-flow"
import type { OracleBalance } from "./oracle-snapshot"
import { type OracleStates, oracleMutate, oracleValuation } from "./oracle-state"

function min(left: bigint, right: bigint): bigint {
	if (left < right) return left
	return right
}

export interface OracleContributionDay {
	readonly applied: bigint
	readonly unfunded: readonly OracleBalance[]
}

/** Same-date contribution amounts per target, independent of flow-array order. */
export function oraclePlannedContributions(
	events: readonly OracleEvent[],
	inflation: number,
): ReadonlyMap<AccountId, bigint> {
	const planned = new Map<AccountId, bigint>()
	for (const event of events) {
		if (event.flow.kind !== "contribution") continue
		const target = event.flow.target
		planned.set(target, (planned.get(target) ?? 0n) + oracleAmount(event, inflation))
	}
	return planned
}

/** Debt comes first: every liability is paid `min(planned, owed)`, a hard obligation. */
export function oracleDebtPayments(
	states: OracleStates,
	planned: ReadonlyMap<AccountId, bigint>,
	date: DateString,
): bigint {
	let paid = 0n
	const targets = [...planned.keys()].sort((left, right) => (left < right ? -1 : 1))
	for (const target of targets) {
		const state = states.get(target)!
		if (state.rule.kind !== "liability") continue
		const wanted = planned.get(target) ?? 0n
		const affordable = min(wanted, oracleValuation(state, date))
		if (affordable > 0n) {
			oracleMutate(state, date, -affordable)
			paid += affordable
		}
	}
	return paid
}

/** Assets share what debt left behind, in the Scenario's `contribute` priority order. */
export function oracleAssetContributions(
	states: OracleStates,
	scenario: Scenario,
	planned: ReadonlyMap<AccountId, bigint>,
	budget: bigint,
	date: DateString,
): OracleContributionDay {
	let left = budget
	let applied = 0n
	const unfunded: OracleBalance[] = []
	for (const target of scenario.cashflow.contribute) {
		const wanted = planned.get(target) ?? 0n
		if (wanted === 0n) continue
		const granted = min(wanted, left)
		if (granted > 0n) {
			oracleMutate(states.get(target)!, date, granted)
			applied += granted
			left -= granted
		}
		if (granted < wanted) unfunded.push({ account: target, amount: wanted - granted })
	}
	return { applied, unfunded }
}
