import type { Fixture } from "../fixtures/fixture"
import type { DateString, ExpenseFlow, Flow, Growth, SurvivalOptions, Timeline } from "../types"
import { oracleAddDays, oracleAddMonthsClamped, oracleGrowthYears } from "./oracle-date"
import { oracleGrow } from "./oracle-money"

/** The oracle covers the survival walk; the buffer is covered by hand-computed fixtures. */
export type OracleFiOptions = Pick<SurvivalOptions, "method" | "retirementSpending">

import { oracleRun } from "./oracle-sim"

function months(timeline: Timeline): readonly DateString[] {
	const first = timeline.start.endsWith("-01")
		? timeline.start
		: oracleAddMonthsClamped(`${timeline.start.slice(0, 7)}-01`, 1)
	const result: DateString[] = []
	for (let date = first; date <= timeline.horizon; date = oracleAddMonthsClamped(date, 1)) {
		result.push(date)
	}
	return result
}

function cut(flow: Flow, month: DateString): readonly Flow[] {
	if (flow.frequency === "once") return flow.start >= month ? [] : [flow]
	if (flow.start >= month) return []
	const end = oracleAddDays(month, -1)
	if (flow.end !== undefined && flow.end <= end) return [flow]
	return [{ ...flow, end }]
}

function retirementRate(growth: Growth, inflation: number): number {
	return growth === "inflation" ? inflation : growth.bps
}

function retirementFlows(
	timeline: Timeline,
	amount: number,
	growth: Growth,
	inflation: number,
	month: DateString,
): readonly ExpenseFlow[] {
	const rate = retirementRate(growth, inflation)
	const flows: ExpenseFlow[] = []
	for (let date = month; date <= timeline.horizon; date = oracleAddMonthsClamped(date, 1)) {
		const years = oracleGrowthYears(timeline.start, date)
		flows.push({
			id: `retirement-${date}`,
			kind: "expense",
			amount: Number(oracleGrow(BigInt(amount), rate, years * 365)),
			frequency: "once",
			start: date,
			growth: { bps: 0 },
		})
	}
	return flows
}

function rewritten(fixture: Fixture, month: DateString, options: OracleFiOptions): Fixture {
	const { timeline, scenario } = fixture
	const retirement = options.retirementSpending
	const kept = scenario.flows.flatMap((flow) => {
		if (flow.kind === "income" && flow.earned) return cut(flow, month)
		if (flow.kind === "expense" && retirement !== undefined) return cut(flow, month)
		return [flow]
	})
	const added =
		retirement === undefined
			? []
			: retirementFlows(
					timeline,
					retirement.amount,
					retirement.growth,
					scenario.economy.inflation,
					month,
				)
	return {
		...fixture,
		scenario: { ...scenario, flows: [...kept, ...added] },
	}
}

/** Naive FI scan: rewrite the Scenario, then ask the independent Projection oracle for a Shortfall. */
export function oracleFiMonth(fixture: Fixture, options: OracleFiOptions): DateString | undefined {
	for (const month of months(fixture.timeline)) {
		const run = oracleRun(rewritten(fixture, month, options), [fixture.timeline.horizon])
		if (run.runsOut === undefined) return month
	}
	return undefined
}
