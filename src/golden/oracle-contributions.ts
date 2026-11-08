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

interface PlannedTarget {
	readonly account: AccountId
	readonly planned: bigint
}

interface AssetGrant extends PlannedTarget {
	readonly granted: bigint
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

/** Liabilities are planned against the amount owed first, then applied in one pass. */
export function oracleDebtPayments(
	states: OracleStates,
	planned: ReadonlyMap<AccountId, bigint>,
	date: DateString,
): bigint {
	const payments: OracleBalance[] = []
	for (const account of [...planned.keys()].sort((left, right) => (left < right ? -1 : 1))) {
		const state = states.get(account)!
		if (state.rule.kind !== "liability") continue
		const payment = min(planned.get(account) ?? 0n, oracleValuation(state, date))
		if (payment > 0n) payments.push({ account, amount: payment })
	}
	let paid = 0n
	for (const payment of payments) {
		oracleMutate(states.get(payment.account)!, date, -payment.amount)
		paid += payment.amount
	}
	return paid
}

/** Assign each target the part of `budget` above the cumulative planned amounts before it. */
function grantPlan(
	scenario: Scenario,
	planned: ReadonlyMap<AccountId, bigint>,
	budget: bigint,
): readonly AssetGrant[] {
	const grants: AssetGrant[] = []
	let before = 0n
	for (const account of scenario.cashflow.contribute) {
		const wanted = planned.get(account) ?? 0n
		if (wanted === 0n) continue
		const room = budget - before
		const granted = room > 0n ? min(wanted, room) : 0n
		grants.push({ account, planned: wanted, granted })
		before += wanted
	}
	return grants
}

/** Assets share what debt left behind, in the Scenario's `contribute` priority order. */
export function oracleAssetContributions(
	states: OracleStates,
	scenario: Scenario,
	planned: ReadonlyMap<AccountId, bigint>,
	budget: bigint,
	date: DateString,
): OracleContributionDay {
	const grants = grantPlan(scenario, planned, budget)
	const unfunded: OracleBalance[] = []
	let applied = 0n
	for (const grant of grants) {
		if (grant.granted > 0n) {
			oracleMutate(states.get(grant.account)!, date, grant.granted)
			applied += grant.granted
		}
		if (grant.granted < grant.planned) {
			unfunded.push({ account: grant.account, amount: grant.planned - grant.granted })
		}
	}
	return { applied, unfunded }
}
