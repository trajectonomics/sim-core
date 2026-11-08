import type { DayTotals } from "../engine/occurrence"
import { isSafeInteger, overflow } from "../engine/overflow"
import type { EngineRun } from "../engine/result"
import type { EngineSnapshot } from "../engine/snapshot"
import type { AnnualRollup, ProjectionProblem } from "../types/projection"
import type { Period } from "./periods"

interface FlowSums {
	readonly income: bigint
	readonly expense: bigint
	readonly contributions: bigint
	readonly unfunded: bigint
}

export interface RollupOutcome {
	readonly annual: readonly AnnualRollup[] | undefined
	readonly problem: ProjectionProblem | undefined
}

function sumFlows(totals: readonly DayTotals[], period: Period): FlowSums {
	let income = 0n
	let expense = 0n
	let contributions = 0n
	let unfunded = 0n
	for (const total of totals) {
		if (total.date < period.from || total.date > period.to) continue
		income += total.income
		expense += total.expense
		contributions += total.contributions
		for (const amount of total.unfunded.values()) unfunded += amount
	}
	return { income, expense, contributions, unfunded }
}

function unsafe(values: readonly bigint[], date: string): ProjectionProblem | undefined {
	for (const value of values) if (!isSafeInteger(value)) return overflow(date)
	return undefined
}

export function buildRollups(
	run: EngineRun,
	periods: readonly Period[],
	opening: bigint,
): RollupOutcome {
	const snapshots = new Map<string, EngineSnapshot>()
	for (const snapshot of run.snapshots) snapshots.set(snapshot.date, snapshot)
	const annual: AnnualRollup[] = []
	let openingWorth = opening
	for (const period of periods) {
		const sums = sumFlows(run.totals, period)
		const closing = snapshots.get(period.to)!.netWorth
		const unmet = run.runsOut?.date === period.to ? run.runsOut.unmet : 0n
		const interest = closing - openingWorth - sums.income + sums.expense - unmet
		const problem = unsafe(
			[
				openingWorth,
				closing,
				sums.income,
				sums.expense,
				sums.contributions,
				sums.unfunded,
				interest,
				unmet,
			],
			period.to,
		)
		if (problem !== undefined) return { annual: undefined, problem }
		annual.push({
			index: period.index,
			from: period.from,
			to: period.to,
			openingNetWorth: Number(openingWorth),
			closingNetWorth: Number(closing),
			income: Number(sums.income),
			expense: Number(sums.expense),
			contributions: Number(sums.contributions),
			unfundedContributions: Number(sums.unfunded),
			interest: Number(interest),
			unmet: Number(unmet),
			partial: period.partial,
		})
		openingWorth = closing
	}
	return { annual, problem: undefined }
}
