import type { EngineLevy, EngineLevyPeriod } from "../engine/levy-types"
import { isSafeInteger, overflow } from "../engine/overflow"
import type { LevyMeasureValue, LevyPeriod, LevyReport, ProjectionProblem } from "../types"

export interface LevyOutcome {
	readonly levy: LevyReport | undefined
	readonly problem: ProjectionProblem | undefined
}

function safe(values: readonly bigint[]): boolean {
	for (const value of values) if (!isSafeInteger(value)) return false
	return true
}

function measuresOf(period: EngineLevyPeriod): readonly LevyMeasureValue[] {
	return period.measures.map((measure) => ({ id: measure.id, value: Number(measure.value) }))
}

function periodOf(period: EngineLevyPeriod): LevyPeriod | undefined {
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

/** Converts the engine's bigint Levy results to reported minor units. */
export function buildLevy(run: EngineLevy | undefined): LevyOutcome {
	if (run === undefined) return { levy: undefined, problem: undefined }
	const periods: LevyPeriod[] = []
	for (const period of run.periods) {
		const reported = periodOf(period)
		if (reported === undefined) {
			return { levy: undefined, problem: overflow(period.settlementDate) }
		}
		periods.push(reported)
	}
	return { levy: { id: run.id, periods }, problem: undefined }
}
