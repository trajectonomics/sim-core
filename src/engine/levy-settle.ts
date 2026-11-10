import { evaluateMeasures } from "../levy/evaluate"
import type { DateString, Levy, MeasuresResult } from "../types"
import type { ProjectionProblem } from "../types/projection"
import { closeReturns } from "./levy-returns"
import { talliesOf } from "./levy-tally"
import type {
	EngineLevyMeasure,
	EngineSettlementPeriod,
	LevyFinish,
	LevyTracker,
	SettlementOutcome,
} from "./levy-types"
import type { StateMap } from "./state"

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

/** Reports the date the engine acted on: a Measure failing at a Due date is reported on the Landed one. */
function landedProblem(problem: ProjectionProblem, date: DateString): ProjectionProblem {
	return "date" in problem ? { ...problem, date } : problem
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
	const context = { date: plan.dueSettlementDate, inflation: tracker.inflation }
	const result = evaluateMeasures(tracker.levy, talliesOf(tally), context)
	if (!result.ok)
		return { period: undefined, problem: landedProblem(result.problem, plan.settlementDate) }
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
export function settleAt(
	tracker: LevyTracker,
	states: StateMap,
	date: DateString,
): SettlementOutcome {
	const index = tracker.settlementIndex.get(date)
	if (index === undefined) return { settlement: 0n, problem: undefined }
	const existing = tracker.results[index]
	if (existing !== undefined) return { settlement: existing.settlement, problem: undefined }
	const plan = tracker.periods[index]
	if (plan !== undefined) closeReturns(states, tracker, plan.to)
	const evaluated = evaluatePeriod(tracker, index, true, false)
	if (evaluated.problem !== undefined) return { settlement: 0n, problem: evaluated.problem }
	return { settlement: evaluated.period!.settlement, problem: undefined }
}

/** Evaluates every period that started by `runEnd` but never settled, in period order. */
export function finishTracker(
	tracker: LevyTracker,
	states: StateMap,
	runEnd: DateString,
): LevyFinish {
	const periods: EngineSettlementPeriod[] = []
	for (const plan of tracker.periods) {
		if (plan.from > runEnd) break
		const existing = tracker.results[plan.index]
		if (existing !== undefined) {
			periods.push(existing)
			continue
		}
		closeReturns(states, tracker, plan.to < runEnd ? plan.to : runEnd)
		const evaluated = evaluatePeriod(tracker, plan.index, false, runEnd < plan.to)
		if (evaluated.problem !== undefined) return { ok: false, problem: evaluated.problem }
		periods.push(evaluated.period!)
	}
	return { ok: true, levy: { id: tracker.levy.id, periods } }
}
