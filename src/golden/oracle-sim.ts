import type { Fixture } from "../fixtures/fixture"
import type { AccountId, DateString } from "../types"
import {
	oracleAssetContributions,
	oracleDebtPayments,
	oraclePlannedContributions,
} from "./oracle-contributions"
import { oracleAddDays } from "./oracle-date"
import { type OracleEvent, oracleEventsByDate } from "./oracle-flow"
import { oracleIncomeExpense, oracleSurplus, oracleWithdraw } from "./oracle-ops"
import { type OracleBalance, type OracleSnapshot, oracleSnapshot } from "./oracle-snapshot"
import type { OracleState, OracleStates } from "./oracle-state"

export interface OracleRunsOut {
	readonly date: DateString
	readonly unmet: bigint
}

export interface OracleFlowDay {
	readonly date: DateString
	readonly income: bigint
	readonly expense: bigint
	readonly contributions: bigint
	readonly unfunded: readonly OracleBalance[]
}

export interface OracleRun {
	readonly snapshots: readonly OracleSnapshot[]
	readonly flows: readonly OracleFlowDay[]
	readonly runsOut?: OracleRunsOut
}

interface OracleDay {
	readonly flow: OracleFlowDay
	readonly runsOut?: OracleRunsOut
}

function createStates(fixture: Fixture): OracleStates {
	const opening = new Map<AccountId, number>()
	for (const balance of fixture.baseline.balances) opening.set(balance.account, balance.amount)
	const states = new Map<AccountId, OracleState>()
	const rules = [...fixture.scenario.accounts].sort((a, b) => (a.id < b.id ? -1 : 1))
	for (const rule of rules) {
		states.set(rule.id, {
			rule,
			balance: BigInt(opening.get(rule.id) ?? 0),
			asOf: fixture.timeline.start,
			accrued: 0n,
		})
	}
	return states
}

function processDay(
	states: OracleStates,
	fixture: Fixture,
	date: DateString,
	events: readonly OracleEvent[],
): OracleDay {
	const { scenario } = fixture
	const inflation = scenario.economy.inflation
	const [income, expense] = oracleIncomeExpense(events, inflation)
	const planned = oraclePlannedContributions(events, inflation)
	const debt = oracleDebtPayments(states, planned, date)
	const cashflow = income - expense - debt
	const budget = cashflow > 0n ? cashflow : 0n
	const assets = oracleAssetContributions(states, scenario, planned, budget, date)
	const flow = {
		date,
		income,
		expense,
		contributions: debt + assets.applied,
		unfunded: assets.unfunded,
	}
	const net = cashflow - assets.applied
	if (net > 0n) oracleSurplus(states, scenario.cashflow.surplus, date, net)
	if (net < 0n) {
		const remaining = oracleWithdraw(states, scenario, date, -net)
		if (remaining > 0n) return { flow, runsOut: { date, unmet: remaining } }
	}
	return { flow }
}

export function oracleRun(fixture: Fixture, observations: readonly DateString[]): OracleRun {
	const { scenario, timeline } = fixture
	const inflation = scenario.economy.inflation
	const states = createStates(fixture)
	const byDate = oracleEventsByDate(fixture)
	const wanted = new Set<DateString>(observations)
	const snapshots: OracleSnapshot[] = []
	const flows: OracleFlowDay[] = []
	for (let date = timeline.start; date <= timeline.horizon; date = oracleAddDays(date, 1)) {
		const day = byDate.get(date)
		const outcome = day === undefined ? undefined : processDay(states, fixture, date, day)
		if (outcome !== undefined) flows.push(outcome.flow)
		const stop = outcome?.runsOut
		if (stop !== undefined || wanted.has(date)) {
			snapshots.push(oracleSnapshot(states, date, timeline.start, inflation))
		}
		if (stop !== undefined) return { snapshots, flows, runsOut: stop }
	}
	return { snapshots, flows }
}
