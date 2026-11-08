import type { Fixture } from "../fixtures/fixture"
import type { DateString } from "../types"
import type { AccountAmount, AnnualRollup, ProjectionRow, RunsOut } from "../types/projection"
import { oracleAnnual, oraclePeriodEnds } from "./oracle-annual"
import type { OracleFlowDay } from "./oracle-sim"
import { oracleRun } from "./oracle-sim"
import type { OracleBalance, OracleSnapshot } from "./oracle-snapshot"

export interface OracleView {
	readonly rows: readonly ProjectionRow[]
	readonly runsOut: RunsOut | undefined
	readonly annual: readonly AnnualRollup[]
	readonly unfundedContributions: readonly AccountAmount[]
}

function unfundedTotals(flows: readonly OracleFlowDay[]): readonly AccountAmount[] {
	const sums = new Map<string, bigint>()
	for (const flow of flows) {
		for (const item of flow.unfunded) {
			sums.set(item.account, (sums.get(item.account) ?? 0n) + item.amount)
		}
	}
	return [...sums.entries()]
		.filter(([, amount]) => amount !== 0n)
		.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
		.map(([account, amount]) => ({ account, amount: Number(amount) }))
}

function amounts(items: readonly OracleBalance[]): ProjectionRow["balances"] {
	return items.map((item) => ({ account: item.account, amount: Number(item.amount) }))
}

function toRow(snapshot: OracleSnapshot): ProjectionRow {
	return {
		date: snapshot.date,
		balances: amounts(snapshot.balances),
		netWorth: Number(snapshot.netWorth),
		accessibleNetWorth: Number(snapshot.accessibleNetWorth),
		realBalances: amounts(snapshot.realBalances),
		realNetWorth: Number(snapshot.realNetWorth),
		realAccessibleNetWorth: Number(snapshot.realAccessibleNetWorth),
	}
}

/** What the independent oracle says `project()` must report for the given row dates. */
export function oracleView(fixture: Fixture, rowDates: readonly DateString[]): OracleView {
	const { start, horizon } = fixture.timeline
	const run = oracleRun(fixture, [...rowDates, ...oraclePeriodEnds(start, horizon)])
	const reported = new Set<DateString>(rowDates)
	return {
		rows: run.snapshots.filter((item) => reported.has(item.date)).map(toRow),
		runsOut:
			run.runsOut === undefined
				? undefined
				: { date: run.runsOut.date, unmet: Number(run.runsOut.unmet) },
		unfundedContributions: unfundedTotals(run.flows),
		annual: oracleAnnual(fixture, run).map((year, index) => ({
			index,
			from: year.from,
			to: year.to,
			openingNetWorth: Number(year.openingNetWorth),
			closingNetWorth: Number(year.closingNetWorth),
			income: Number(year.income),
			expense: Number(year.expense),
			contributions: Number(year.contributions),
			unfundedContributions: Number(year.unfundedContributions),
			interest: Number(year.interest),
			unmet: Number(year.unmet),
			partial: year.partial,
		})),
	}
}
