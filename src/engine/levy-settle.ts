import { evaluateMeasures } from "../levy/evaluate"
import type { DateString, Levy, MeasuresResult } from "../types"
import type { ProjectionProblem } from "../types/projection"
import { talliesOf } from "./levy-tally"
import type {
	EngineLevyMeasure,
	EngineSettlementPeriod,
	LevyFinish,
	LevyTracker,
	SettlementOutcome,
} from "./levy-types"

function measureValues(
	levy: Levy,
	result: MeasuresResult & { readonly ok: true },
): readonly EngineLevyMeasure[] {
	const values: EngineLevyMeasure[] = []
	for (const measure of levy.measures) {
		const value = result.values.get(measure.id)
		if (value !== undefined) values.push({ id: measure.id, value: BigInt(value) })
	}
	return values
}

interface Evaluation {
	readonly period: EngineSettlementPeriod | undefined
	readonly problem: ProjectionProblem | undefined
}

function evaluatePeriod(
	tracker: LevyTracker,
	index: number,
	settled: boolean,
	partial: boolean,
): Evaluation {
	const plan = tracker.periods[index]
	const tally = tracker.tallies[index]
	if (plan === undefined || tally === undefined) return { period: undefined, problem: undefined }
	const context = { date: plan.settlementDate, inflation: tracker.inflation }
	const result = evaluateMeasures(tracker.levy, talliesOf(tally), context)
	if (!result.ok) return { period: undefined, problem: result.problem }
	const due = BigInt(result.due)
	const period: EngineSettlementPeriod = {
		from: plan.from,
		to: plan.to,
		settlementDate: plan.settlementDate,
		measures: measureValues(tracker.levy, result),
		prepaid: tally.prepaid,
		due,
		settlement: due - tally.prepaid,
		settled,
		partial,
	}
	tracker.results[index] = period
	return { period, problem: undefined }
}

/** Evaluates and records the Settlement falling on `date`, if any; no Settlement is 0. */
export function settleAt(tracker: LevyTracker, date: DateString): SettlementOutcome {
	const index = tracker.settlementIndex.get(date)
	if (index === undefined) return { settlement: 0n, problem: undefined }
	const existing = tracker.results[index]
	if (existing !== undefined) return { settlement: existing.settlement, problem: undefined }
	const evaluated = evaluatePeriod(tracker, index, true, false)
	if (evaluated.problem !== undefined) return { settlement: 0n, problem: evaluated.problem }
	return { settlement: evaluated.period!.settlement, problem: undefined }
}

/** Evaluates every period that started by `runEnd` but never settled, in period order. */
export function finishTracker(tracker: LevyTracker, runEnd: DateString): LevyFinish {
	const periods: EngineSettlementPeriod[] = []
	for (const plan of tracker.periods) {
		if (plan.from > runEnd) break
		const existing = tracker.results[plan.index]
		if (existing !== undefined) {
			periods.push(existing)
			continue
		}
		const evaluated = evaluatePeriod(tracker, plan.index, false, runEnd < plan.to)
		if (evaluated.problem !== undefined) return { ok: false, problem: evaluated.problem }
		periods.push(evaluated.period!)
	}
	return { ok: true, levy: { id: tracker.levy.id, periods } }
}
