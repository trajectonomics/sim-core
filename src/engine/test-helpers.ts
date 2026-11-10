/** TEST-ONLY builders; not imported by `src/index.ts`, so they stay out of the package. */
import type { Fixture } from "../fixtures/fixture"
import type {
	Account,
	AccountId,
	BasisPoints,
	Calendar,
	CarryIn,
	DateString,
	Flow,
	Levy,
	MinorUnits,
	Resolution,
	Scenario,
	SurplusStep,
	Timeline,
} from "../types"
import type {
	Projection,
	ProjectionProblem,
	ProjectionRow,
	SettlementPeriod,
} from "../types/projection"
import { project } from "./project"

export interface Setup {
	readonly accounts: readonly Account[]
	readonly balances: Readonly<Record<string, MinorUnits>>
	readonly flows?: readonly Flow[]
	readonly surplus: readonly SurplusStep[]
	readonly contribute?: readonly AccountId[]
	readonly withdraw?: readonly AccountId[]
	readonly start?: DateString
	readonly horizon?: DateString
	readonly resolution?: Resolution
	readonly inflation?: BasisPoints
	readonly levy?: Levy
	readonly calendar?: Calendar
}

export function makeFixture(setup: Setup): Fixture {
	const scenario: Scenario = {
		schemaVersion: 3,
		currency: "THB",
		economy: { inflation: setup.inflation ?? 0 },
		accounts: setup.accounts,
		flows: setup.flows ?? [],
		cashflow: {
			surplus: setup.surplus,
			contribute: setup.contribute ?? [],
			withdraw: setup.withdraw ?? [],
		},
		...(setup.levy === undefined ? {} : { levy: setup.levy }),
		...(setup.calendar === undefined ? {} : { calendar: setup.calendar }),
	}
	const timeline: Timeline = {
		start: setup.start ?? "2026-01-01",
		horizon: setup.horizon ?? "2027-01-01",
		resolution: setup.resolution ?? "day",
	}
	const balances = Object.entries(setup.balances).map(([account, amount]) => ({ account, amount }))
	return { baseline: { schemaVersion: 1, balances }, scenario, timeline }
}

export function run(setup: Setup): Projection {
	const { baseline, scenario, timeline } = makeFixture(setup)
	const result = project(baseline, scenario, timeline)
	if (!result.ok) throw new Error(JSON.stringify(result.problems))
	return result.projection
}

export function problems(setup: Setup): readonly ProjectionProblem[] {
	const { baseline, scenario, timeline } = makeFixture(setup)
	const result = project(baseline, scenario, timeline)
	if (result.ok) throw new Error("Expected a projection failure")
	return result.problems
}

/** An empty Carry-in record for a period that the Timeline start cut off. */
export function emptyCarryIn(periodStart: DateString): CarryIn {
	return { periodStart, tallies: [], prepaid: 0 }
}

export function withCarryIn(levy: Levy, ...records: readonly CarryIn[]): Levy {
	return { ...levy, carryIn: records }
}

export function periodFrom(projection: Projection, from: DateString): SettlementPeriod {
	const period = projection.levy?.periods.find((item) => item.from === from)
	if (period === undefined) throw new Error(`Missing Settlement period ${from}`)
	return period
}

export function rowAt(projection: Projection, date: DateString): ProjectionRow {
	const row = projection.rows.find((item) => item.date === date)
	if (!row) throw new Error(`Missing row ${date}`)
	return row
}

export function amounts(row: ProjectionRow): Readonly<Record<string, MinorUnits>> {
	return Object.fromEntries(row.balances.map((balance) => [balance.account, balance.amount]))
}
