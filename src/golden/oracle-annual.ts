import type { Fixture } from "../fixtures/fixture"
import type { DateString } from "../types"
import { oracleAddDays, oracleAddMonthsClamped } from "./oracle-date"
import type { OracleRun } from "./oracle-sim"

export interface OracleYear {
	readonly from: DateString
	readonly to: DateString
	readonly openingNetWorth: bigint
	readonly closingNetWorth: bigint
	readonly income: bigint
	readonly expense: bigint
	readonly contributions: bigint
	readonly unfundedContributions: bigint
	readonly interest: bigint
	readonly unmet: bigint
	readonly partial: boolean
}

function yearEnd(start: DateString, index: number): DateString {
	return oracleAddDays(oracleAddMonthsClamped(start, (index + 1) * 12), -1)
}

/** Last day of each full twelve-month period ending on or before the horizon. */
export function oraclePeriodEnds(start: DateString, horizon: DateString): DateString[] {
	const ends: DateString[] = []
	for (let index = 0; yearEnd(start, index) <= horizon; index++) ends.push(yearEnd(start, index))
	return ends
}

function earlier(left: DateString, right: DateString): DateString {
	if (left < right) return left
	return right
}

function openingNetWorth(fixture: Fixture): bigint {
	const kinds = new Map(fixture.scenario.accounts.map((rule) => [rule.id, rule.kind]))
	let total = 0n
	for (const { account, amount } of fixture.baseline.balances) {
		total += kinds.get(account) === "liability" ? -BigInt(amount) : BigInt(amount)
	}
	return total
}

/** Annual roll-ups: twelve months from each anniversary of `start` to the day before the next. */
export function oracleAnnual(fixture: Fixture, run: OracleRun): OracleYear[] {
	const { start, horizon } = fixture.timeline
	const end = run.runsOut?.date ?? horizon
	const worth = new Map(run.snapshots.map((snapshot) => [snapshot.date, snapshot.netWorth]))
	const years: OracleYear[] = []
	let opening = openingNetWorth(fixture)
	let from = start
	for (let index = 0; ; index++) {
		const last = yearEnd(start, index)
		const to = earlier(end, last)
		const days = run.flows.filter((flow) => flow.date >= from && flow.date <= to)
		const sum = (pick: (flow: (typeof days)[number]) => bigint): bigint =>
			days.reduce((total, flow) => total + pick(flow), 0n)
		const income = sum((flow) => flow.income)
		const expense = sum((flow) => flow.expense)
		const unfunded = sum((flow) => flow.unfunded.reduce((total, item) => total + item.amount, 0n))
		const unmet = run.runsOut?.date === to ? run.runsOut.unmet : 0n
		const closing = worth.get(to)!
		years.push({
			from,
			to,
			openingNetWorth: opening,
			closingNetWorth: closing,
			income,
			expense,
			contributions: sum((flow) => flow.contributions),
			unfundedContributions: unfunded,
			interest: closing - opening - income + expense - unmet,
			unmet,
			partial: to < last || to === run.runsOut?.date,
		})
		if (to === end) return years
		opening = closing
		from = oracleAddDays(to, 1)
	}
}
