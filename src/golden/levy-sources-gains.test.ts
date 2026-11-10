import { describe, expect, it } from "bun:test"
import { project } from "../engine/project"
import type { Returns } from "../engine/returns"
import { runEngine } from "../engine/run"
import { contribution, expense, income } from "../engine/test-flows"
import { emptyCarryIn, makeFixture } from "../engine/test-helpers"
import { buildProjection } from "../output/build"
import { periodEndDates } from "../output/periods"
import { rowDates } from "../output/row-dates"
import type { DateString, Levy, MinorUnits, Projection } from "../types"
import { oracleGain } from "./oracle-levy"
import { oracleResolveRows, oracleSpanGrow } from "./oracle-returns"

function gainsLevy(due: number): Levy {
	return {
		id: "gains",
		period: { month: 1, day: 1 },
		settlement: { month: 3, day: 31 },
		measures:
			due === 0
				? [
						{ id: "gain", op: "tally", label: "gain", basis: "gains" },
						{ id: "due", op: "const", value: 0 },
					]
				: [
						{ id: "gain", op: "tally", label: "gain", basis: "gains" },
						{ id: "due", op: "const", value: due },
					],
		due: "due",
	}
}

function gained(projection: Projection, from: string): MinorUnits {
	const period = projection.levies?.[0]?.periods.find((item) => item.from === from)
	if (period === undefined) throw new Error(`Missing period ${from}`)
	const found = period.measures.find((item) => item.id === "gain")
	if (found === undefined) throw new Error("Missing gain")
	return found.value
}

function projected(fixture: Parameters<typeof makeFixture>[0]): Projection {
	const { baseline, scenario, timeline } = makeFixture(fixture)
	const result = project(baseline, scenario, timeline)
	if (!result.ok) throw new Error(JSON.stringify(result.problems))
	return result.projection
}

const brokerage = { id: "brokerage", kind: "asset", rate: 0, gainLabel: "gain" } as const
const prior = emptyCarryIn("2025-01-01")

describe("golden gains tally cases", () => {
	it("realises average cost on a partial sale of an embedded gain", () => {
		const projection = projected({
			accounts: [brokerage],
			balances: { brokerage: 120_000 },
			basis: { brokerage: 100_000 },
			flows: [expense("sell", 60_000, { start: "2026-06-01" })],
			surplus: [{ account: "brokerage" }],
			withdraw: ["brokerage"],
			start: "2026-01-01",
			horizon: "2026-12-31",
			levy: { ...gainsLevy(0), carryIn: [prior] },
		})
		expect(gained(projection, "2026-01-01")).toBe(Number(oracleGain(100_000n, 60_000n, 120_000n)))
	})

	it("realises a loss on a sale below cost", () => {
		const projection = projected({
			accounts: [brokerage],
			balances: { brokerage: 80_000 },
			basis: { brokerage: 100_000 },
			flows: [expense("sell", 40_000, { start: "2027-06-01" })],
			surplus: [{ account: "brokerage" }],
			withdraw: ["brokerage"],
			start: "2027-01-01",
			horizon: "2027-12-31",
			levy: { ...gainsLevy(0), carryIn: [emptyCarryIn("2026-01-01")] },
		})
		expect(gained(projection, "2027-01-01")).toBe(Number(oracleGain(100_000n, 40_000n, 80_000n)))
	})

	it("realises a Settlement's sale in the following period", () => {
		const projection = projected({
			accounts: [brokerage],
			balances: { brokerage: 120_000 },
			basis: { brokerage: 100_000 },
			surplus: [{ account: "brokerage" }],
			withdraw: ["brokerage"],
			start: "2026-07-01",
			horizon: "2027-12-31",
			levy: { ...gainsLevy(1000), carryIn: [emptyCarryIn("2026-01-01")] },
		})
		expect(gained(projection, "2026-01-01")).toBe(0)
		expect(gained(projection, "2027-01-01")).toBe(Number(oracleGain(100_000n, 1000n, 120_000n)))
	})

	it("adds contributions and surplus fills to the pooled basis", () => {
		const projection = projected({
			accounts: [brokerage],
			balances: { brokerage: 100_000 },
			basis: { brokerage: 100_000 },
			flows: [
				income("pay", 50_000, { start: "2026-01-01" }),
				contribution("save", "brokerage", 20_000, { start: "2026-01-01" }),
				expense("sell", 75_000, { start: "2026-06-01" }),
			],
			surplus: [{ account: "brokerage" }],
			contribute: ["brokerage"],
			withdraw: ["brokerage"],
			start: "2026-01-01",
			horizon: "2026-12-31",
			levy: { ...gainsLevy(0), carryIn: [prior] },
		})
		expect(gained(projection, "2026-01-01")).toBe(Number(oracleGain(150_000n, 75_000n, 150_000n)))
	})

	it("realises the grown value's share of basis when a Return series covered the Account", () => {
		const rows = [
			{ from: "2026-01-01", returnBps: 1000 },
			{ from: "2028-01-01", returnBps: 0 },
		]
		const series = oracleResolveRows(rows, "2027-12-31")
		const valueBefore = oracleSpanGrow(100_000n, "2026-01-01", "2027-06-01", series)
		const returns: Returns = {
			returnsVersion: 1,
			series: [{ account: "brokerage", rows }],
		}
		const { baseline, scenario, timeline } = makeFixture({
			accounts: [brokerage],
			balances: { brokerage: 100_000 },
			basis: { brokerage: 100_000 },
			flows: [expense("sell", 53_534, { start: "2027-06-01" })],
			surplus: [{ account: "brokerage" }],
			withdraw: ["brokerage"],
			start: "2026-01-01",
			horizon: "2027-12-31",
			levy: { ...gainsLevy(0), carryIn: [prior] },
		})
		const observations: readonly DateString[] = [
			...rowDates(timeline),
			...periodEndDates(timeline.start, timeline.horizon),
		]
		const run = runEngine(baseline, scenario, timeline, observations, returns)
		if (!run.ok) throw new Error(JSON.stringify(run.problem))
		const built = buildProjection(run.run, baseline, scenario, timeline)
		if ("problem" in built) throw new Error(JSON.stringify(built.problem))
		expect(gained(built.projection, "2027-01-01")).toBe(
			Number(oracleGain(100_000n, 53_534n, valueBefore)),
		)
	})
})
