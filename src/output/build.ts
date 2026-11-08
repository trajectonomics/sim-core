import type { EngineRun } from "../engine/result"
import type { Baseline, Scenario, Timeline } from "../types"
import type { Projection, ProjectionProblem } from "../types/projection"
import { buildLevy } from "./levy"
import { openingNetWorth } from "./opening"
import { buildPeriods } from "./periods"
import { buildRollups } from "./rollups"
import { rowDates } from "./row-dates"
import { buildRows } from "./rows"
import { accountRules } from "./rules"

export type BuildResult =
	| { readonly projection: Projection }
	| { readonly problem: ProjectionProblem }

export function buildProjection(
	run: EngineRun,
	baseline: Baseline,
	scenario: Scenario,
	timeline: Timeline,
): BuildResult {
	const rules = accountRules(scenario)
	const reported = new Set<string>(rowDates(timeline))
	const shown = run.snapshots.filter(
		(snapshot) => reported.has(snapshot.date) || snapshot.date === run.runsOut?.date,
	)
	const rows = buildRows(shown, timeline, rules, scenario.economy.inflation)
	if (rows.problem !== undefined) return { problem: rows.problem }
	const end = run.runsOut?.date ?? timeline.horizon
	const periods = buildPeriods(timeline.start, end, run.runsOut?.date)
	const rollups = buildRollups(run, periods, openingNetWorth(baseline, rules))
	if (rollups.problem !== undefined) return { problem: rollups.problem }
	const levy = buildLevy(run.levy)
	if (levy.problem !== undefined) return { problem: levy.problem }
	const projection: Projection = {
		rows: rows.rows!,
		annual: rollups.annual!,
		...(run.runsOut === undefined
			? {}
			: { runsOut: { date: run.runsOut.date, unmet: Number(run.runsOut.unmet) } }),
		...(levy.levy === undefined ? {} : { levy: levy.levy }),
	}
	return { projection }
}
