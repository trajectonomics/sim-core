import type { DateString, Scenario, SurplusStep } from "../types"
import { type OracleEvent, oracleAmount } from "./oracle-flow"
import { type OracleStates, oracleMutate, oracleValuation } from "./oracle-state"

function min(left: bigint, right: bigint): bigint {
	if (left < right) return left
	return right
}

export function oracleIncomeExpense(
	events: readonly OracleEvent[],
	inflation: number,
): readonly [income: bigint, expense: bigint] {
	let income = 0n
	let expense = 0n
	for (const event of events) {
		const amount = oracleAmount(event, inflation)
		if (event.flow.kind === "income") income += amount
		if (event.flow.kind === "expense") expense += amount
	}
	return [income, expense]
}

export function oracleSurplus(
	states: OracleStates,
	surplus: readonly SurplusStep[],
	date: DateString,
	amount: bigint,
): void {
	let remaining = amount
	for (const step of surplus) {
		if (remaining === 0n) return
		const state = states.get(step.account)!
		const headroom =
			step.upTo === undefined ? remaining : BigInt(step.upTo) - oracleValuation(state, date)
		let fill = 0n
		if (headroom > 0n) fill = min(remaining, headroom)
		if (fill > 0n) {
			oracleMutate(state, date, fill)
			remaining -= fill
		}
	}
}

export function oracleWithdraw(
	states: OracleStates,
	scenario: Scenario,
	date: DateString,
	amount: bigint,
): bigint {
	let remaining = amount
	for (const account of scenario.cashflow.withdraw) {
		if (remaining === 0n) return 0n
		const state = states.get(account)!
		const locked =
			state.rule.kind === "asset" &&
			state.rule.lockedUntil !== undefined &&
			date < state.rule.lockedUntil
		if (locked) continue
		const take = min(remaining, oracleValuation(state, date))
		if (take > 0n) {
			oracleMutate(state, date, -take)
			remaining -= take
		}
	}
	return remaining
}
