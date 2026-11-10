import type { EngineLevy, EngineSettlementPeriod } from "../engine/levy-types"
import { isSafeInteger, overflow } from "../engine/overflow"
import type { LevyMeasureValue, LevyReport, ProjectionProblem, SettlementPeriod } from "../types"

export interface LeviesOutcome {
	readonly levies: readonly LevyReport[] | undefined
	readonly problem: ProjectionProblem | undefined
}

function safe(values: readonly bigint[]): boolean {
	for (const value of values) if (!isSafeInteger(value)) return false
	return true
}

function measuresOf(period: EngineSettlementPeriod): readonly LevyMeasureValue[] {
	return period.measures.map((measure) => ({ id: measure.id, value: Number(measure.value) }))
}

function settlementPeriodOf(period: EngineSettlementPeriod): SettlementPeriod | undefined {
	if (!safe([period.prepaid, period.due, period.settlement])) return undefined
	if (!safe(period.measures.map((measure) => measure.value))) return undefined
	return {
		from: period.from,
		to: period.to,
		settlementDate: period.settlementDate,
		measures: measuresOf(period),
		prepaid: Number(period.prepaid),
		due: Number(period.due),
		settlement: Number(period.settlement),
		settled: period.settled,
		partial: period.partial,
	}
}

function reportOf(run: EngineLevy): LevyReport | ProjectionProblem {
	const periods: SettlementPeriod[] = []
	for (const period of run.periods) {
		const reported = settlementPeriodOf(period)
		if (reported === undefined) return overflow(period.settlementDate)
		periods.push(reported)
	}
	return { id: run.id, periods }
}

/** Converts the engine's bigint Levy results to reported minor units, in Scenario order. */
export function buildLevies(runs: readonly EngineLevy[] | undefined): LeviesOutcome {
	if (runs === undefined || runs.length === 0) return { levies: undefined, problem: undefined }
	const levies: LevyReport[] = []
	for (const run of runs) {
		const report = reportOf(run)
		if ("code" in report) return { levies: undefined, problem: report }
		levies.push(report)
	}
	return { levies, problem: undefined }
}
