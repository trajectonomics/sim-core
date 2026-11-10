import { describe, expect, it } from "bun:test"
import type { CarryIn, Flow, Levy, MinorUnits, SettlementPeriod } from "../types"
import { project } from "./project"
import { income, prepays } from "./test-flows"
import { amounts, makeFixture, problems, rowAt, run, type Setup } from "./test-helpers"

const MAX = Number.MAX_SAFE_INTEGER

const empty = (periodStart: string): CarryIn => ({ periodStart, tallies: [], prepaid: 0 })

const gross = (periodStart: string, amount: MinorUnits): CarryIn => ({
	periodStart,
	tallies: [{ label: "salary", basis: "gross", amount }],
	prepaid: 0,
})

/** A Levy owing `percent` of the salary gross over a calendar year. */
function share(id: string, percent: number, settlement = { month: 3, day: 31 }): Levy {
	return {
		id,
		period: { month: 1, day: 1 },
		settlement,
		measures: [
			{ id: "gross", op: "tally", label: "salary", basis: "gross" },
			{ id: "due", op: "scale", of: "gross", num: percent, den: 100, rounding: "halfUp" },
		],
		due: "due",
		carryIn: [empty("2025-01-01")],
	}
}

const base = (
	levies: readonly Levy[],
	flows: readonly Flow[],
	extra: Omit<Partial<Setup>, "flows"> = {},
): Setup => ({
	accounts: [{ id: "cash", kind: "asset", rate: 0 }],
	balances: { cash: 0 },
	flows,
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	levies,
	horizon: "2027-12-31",
	...extra,
})

const salary = (amount: MinorUnits, options: Parameters<typeof income>[2] = {}) =>
	income("salary", amount, {
		frequency: "monthly",
		start: "2026-01-01",
		label: "salary",
		...options,
	})

describe("several Levies in one Scenario", () => {
	it("gives each Levy its own period and settlement dates", () => {
		const july = {
			...share("b", 5, { month: 9, day: 30 }),
			period: { month: 7, day: 1 },
			carryIn: [empty("2025-07-01")],
		}
		const projection = run(base([share("a", 10), july], [salary(1_000_000)]))
		expect(projection.levies?.map((report) => report.id)).toEqual(["a", "b"])
		const [first, second] = projection.levies ?? []
		const pick = (periods: readonly SettlementPeriod[] | undefined, from: string) =>
			periods?.find((period) => period.from === from)
		// 12 x 1,000,000 at 10%, settling on 31 March after the period.
		expect(pick(first?.periods, "2026-01-01")).toMatchObject({
			to: "2026-12-31",
			settlementDate: "2027-03-31",
			due: 1_200_000,
		})
		// The July period that contains `start` settles 2026-09-30; the next settles 2027-09-30.
		expect(pick(second?.periods, "2025-07-01")).toMatchObject({
			to: "2026-06-30",
			settlementDate: "2026-09-30",
			due: 300_000,
		})
		expect(pick(second?.periods, "2026-07-01")).toMatchObject({
			to: "2027-06-30",
			settlementDate: "2027-09-30",
			due: 600_000,
		})
	})

	it("nets a refund and a payment that fall on one Landed date into one movement", () => {
		const refund: Levy = { ...share("a", 0), measures: [{ id: "due", op: "const", value: 0 }] }
		// 100% of the salary gross, so its empty 2025 Carry-in period owes nothing.
		const charge: Levy = share("b", 100)
		const payload = salary(1_000_000, {
			frequency: "once",
			start: "2026-01-31",
			prepayments: prepays("a", 10_000),
		})
		const projection = run(base([refund, charge], [payload], { horizon: "2027-06-30" }))
		const period = (from: string) => (periods: readonly SettlementPeriod[] | undefined) =>
			periods?.find((item) => item.from === from)
		expect(
			projection.levies?.map((report) => period("2026-01-01")(report.periods)?.settlement),
		).toEqual([-1_000_000, 1_000_000])
		// The refund pays for the charge before cash moves, so the date never runs short.
		expect(projection.runsOut).toBeUndefined()
		expect(amounts(rowAt(projection, "2027-03-31"))).toEqual({ cash: 0 })
		expect(projection.annual[0]?.levy).toBe(1_000_000)
	})

	it("rounds a split Prepayment cumulatively so it never exceeds the gross", () => {
		const zero = (id: string): Levy => ({
			...share(id, 0),
			measures: [{ id: "due", op: "const", value: 0 }],
			carryIn: [empty("2025-01-01")],
		})
		const payload = income("salary", 1, {
			start: "2026-01-31",
			label: "salary",
			prepayments: [...prepays("a", 5000), ...prepays("b", 5000)],
		})
		const projection = run(base([zero("a"), zero("b")], [payload], { horizon: "2026-12-31" }))
		// Half up of 0.5 is 1 for the first Levy; the second gets 1 - 1 = 0.
		expect(
			projection.levies?.map(
				(report) => report.periods.find((item) => item.from === "2026-01-01")?.prepaid,
			),
		).toEqual([1, 0])
		expect(amounts(rowAt(projection, "2026-01-31"))).toEqual({ cash: 0 })
	})

	it("seeds each Levy's Carry-in separately", () => {
		const projection = run(
			base(
				[
					{ ...share("a", 100), carryIn: [gross("2026-01-01", 10_000_000)] },
					{ ...share("b", 100), carryIn: [gross("2026-01-01", 20_000_000)] },
				],
				[salary(1_000_000)],
				{ start: "2026-07-01", horizon: "2026-12-31" },
			),
		)
		expect(projection.levies?.map((report) => report.periods.at(-1)?.due)).toEqual([
			16_000_000, 26_000_000,
		])
	})

	it("reports the first failing Levy in Scenario order", () => {
		const unsafe = (id: string): Levy => ({
			...share(id, 100),
			carryIn: [gross("2026-01-01", MAX)],
		})
		const overflow = (id: string): Levy => ({
			id,
			period: { month: 1, day: 1 },
			settlement: { month: 3, day: 31 },
			measures: [
				{ id: "huge", op: "const", value: MAX },
				{ id: "due", op: "scale", of: "huge", num: 2, den: 1, rounding: "halfUp" },
			],
			due: "due",
			carryIn: [empty("2026-01-01")],
		})
		const payload = income("salary", 1, { start: "2026-06-15", label: "salary" })
		const setup = (levies: readonly Levy[]): Setup =>
			base(levies, [payload], { start: "2026-06-01", horizon: "2027-06-30" })
		expect(problems(setup([unsafe("a"), overflow("b")]))).toEqual([
			{ code: "NOT_SAFE_INTEGER", path: ["gross", "salary"] },
		])
		expect(problems(setup([overflow("b"), unsafe("a")]))).toEqual([
			{ code: "VALUE_OVERFLOW", date: "2027-03-31" },
		])
	})

	it("projects a fixture with two Levies through the public entry point", () => {
		const fixture = makeFixture(
			base(
				[share("a", 10), { ...share("b", 5), carryIn: [empty("2025-01-01")] }],
				[salary(1_000_000)],
			),
		)
		const result = project(fixture.baseline, fixture.scenario, fixture.timeline)
		expect(result.ok).toBe(true)
	})
})
