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
	readonly levy: bigint
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
	let levy = 0n
	for (const total of totals) {
		if (total.date < period.from || total.date > period.to) continue
		income += total.income
		expense += total.expense
		contributions += total.contributions
		for (const amount of total.unfunded.values()) unfunded += amount
		levy += total.levy
	}
	return { income, expense, contributions, unfunded, levy }
}

function unsafe(values: readonly bigint[], date: string): ProjectionProblem | undefined {
	for (const value of values) if (!isSafeInteger(value)) return overflow(date)
	return undefined
}

function rollupOf(
	period: Period,
	sums: FlowSums,
	opening: bigint,
	closing: bigint,
	unmet: bigint,
	hasLevy: boolean,
): AnnualRollup {
	const interest = closing - opening - sums.income + sums.expense + sums.levy - unmet
	return {
		index: period.index,
		from: period.from,
		to: period.to,
		openingNetWorth: Number(opening),
		closingNetWorth: Number(closing),
		income: Number(sums.income),
		expense: Number(sums.expense),
		contributions: Number(sums.contributions),
		unfundedContributions: Number(sums.unfunded),
		...(hasLevy ? { levy: Number(sums.levy) } : {}),
		interest: Number(interest),
		unmet: Number(unmet),
		partial: period.partial,
	}
}

export function buildRollups(
	run: EngineRun,
	periods: readonly Period[],
	opening: bigint,
): RollupOutcome {
	const snapshots = new Map<string, EngineSnapshot>()
	for (const snapshot of run.snapshots) snapshots.set(snapshot.date, snapshot)
	const annual: AnnualRollup[] = []
	const hasLevy = run.levies !== undefined && run.levies.length > 0
	let openingWorth = opening
	for (const period of periods) {
		const sums = sumFlows(run.totals, period)
		const closing = snapshots.get(period.to)!.netWorth
		const unmet = run.runsOut?.date === period.to ? run.runsOut.unmet : 0n
		const interest = closing - openingWorth - sums.income + sums.expense + sums.levy - unmet
		const problem = unsafe(
			[
				openingWorth,
				closing,
				sums.income,
				sums.expense,
				sums.contributions,
				sums.unfunded,
				sums.levy,
				interest,
				unmet,
			],
			period.to,
		)
		if (problem !== undefined) return { annual: undefined, problem }
		annual.push(rollupOf(period, sums, openingWorth, closing, unmet, hasLevy))
		openingWorth = closing
	}
	return { annual, problem: undefined }
}
