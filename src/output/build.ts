import type { EngineRun } from "../engine/result"
import type { Baseline, Scenario, Timeline } from "../types"
import type { Projection, ProjectionProblem } from "../types/projection"
import { buildLevies } from "./levy"
import { openingNetWorth } from "./opening"
import { buildPeriods } from "./periods"
import { buildRollups } from "./rollups"
import { rowDates } from "./row-dates"
import { buildRows } from "./rows"
import { accountRules } from "./rules"
import { buildUnfunded } from "./unfunded"

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
	const unfunded = buildUnfunded(run.totals, end)
	if (unfunded.problem !== undefined) return { problem: unfunded.problem }
	const levies = buildLevies(run.levies)
	if (levies.problem !== undefined) return { problem: levies.problem }
	const projection: Projection = {
		rows: rows.rows!,
		annual: rollups.annual!,
		unfundedContributions: unfunded.amounts!,
		...(run.runsOut === undefined
			? {}
			: { runsOut: { date: run.runsOut.date, unmet: Number(run.runsOut.unmet) } }),
		...(levies.levies === undefined ? {} : { levies: levies.levies }),
	}
	return { projection }
}
