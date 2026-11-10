import { describe, expect, it } from "bun:test"
import type { Derive, Flow, Levy } from "../types"
import { project } from "./project"
import { derivedContribution, derivedExpense, derivedIncome, income } from "./test-flows"
import { amounts, makeFixture, problems, rowAt, run, type Setup } from "./test-helpers"

const CASH = [{ id: "cash", kind: "asset", rate: 0 }] as const

const setup = (flows: readonly Flow[], extra: Omit<Partial<Setup>, "flows"> = {}): Setup => ({
	accounts: CASH,
	balances: { cash: 0 },
	flows,
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	horizon: "2027-12-31",
	...extra,
})

/** `percent` of the named Flow's planned gross amount. */
function portion(flow: string, percent: number, rounding: "halfUp" | "floor" = "halfUp"): Derive {
	return {
		measures: [
			{ id: "source", op: "flow", flow },
			{ id: "result", op: "scale", of: "source", num: percent, den: 100, rounding },
		],
		result: "result",
	}
}

describe("Derived Flow amounts in the engine", () => {
	it("follows a salary raise with rent at 30% of salary", () => {
		const projection = run(
			setup([
				income("salary", 1_000_000, {
					frequency: "monthly",
					start: "2026-01-31",
					growth: { bps: 5000 },
				}),
				derivedExpense("rent", portion("salary", 30), {
					frequency: "monthly",
					start: "2026-01-31",
				}),
			]),
		)
		// 1,000,000 - 300,000, then 1,500,000 - 450,000 after one whole year of 5,000 bps.
		expect(amounts(rowAt(projection, "2026-01-31"))).toEqual({ cash: 700_000 })
		// Twelve months of 700,000 and one of 1,050,000.
		expect(amounts(rowAt(projection, "2027-01-31"))).toEqual({ cash: 9_450_000 })
	})

	it("evaluates a chain in dependency order", () => {
		const projection = run(
			setup([
				income("a", 100, { start: "2026-01-31" }),
				derivedIncome("b", portion("a", 200), { start: "2026-01-31" }),
				derivedIncome("c", portion("b", 300), { start: "2026-01-31" }),
			]),
		)
		expect(amounts(rowAt(projection, "2026-01-31"))).toEqual({ cash: 900 })
	})

	it("reads 0 on a date its source does not land", () => {
		const projection = run(
			setup([
				income("salary", 100, { start: "2026-01-31" }),
				derivedIncome("early", portion("salary", 100), { start: "2026-01-01" }),
				derivedIncome("share", portion("salary", 100), { start: "2026-01-31" }),
			]),
		)
		// The 1 January share lands the day before any salary: it reads 0. The 31 January share reads 100.
		expect(amounts(rowAt(projection, "2026-01-01"))).toEqual({ cash: 0 })
		expect(amounts(rowAt(projection, "2026-01-31"))).toEqual({ cash: 200 })
	})

	it("sums a Flow's Occurrences when the Calendar lands two of them together", () => {
		const projection = run(
			setup(
				[
					income("daily", 100, {
						frequency: "daily",
						start: "2026-01-03",
						end: "2026-01-04",
					}),
					derivedExpense("taken", portion("daily", 100), { start: "2026-01-05" }),
				],
				{ calendar: { dayRule: "next", holidays: [] }, horizon: "2026-01-31" },
			),
		)
		// Saturday 3 January and Sunday 4 January both land on Monday 5 January: 200 in, 200 out.
		expect(amounts(rowAt(projection, "2026-01-05"))).toEqual({ cash: 0 })
	})

	it("caps a derived contribution by Available cashflow", () => {
		const setupCase = setup([
			income("salary", 1_000, { start: "2026-01-31" }),
			derivedIncome("extra", portion("salary", 30), { start: "2026-01-31" }),
			// 200% of salary asked while only 1,300 is available.
			derivedContribution("save", "savings", portion("salary", 200), { start: "2026-01-31" }),
		])
		const projection = run({
			...setupCase,
			accounts: [...CASH, { id: "savings", kind: "asset", rate: 0 }],
			contribute: ["savings"],
			horizon: "2026-01-31",
		})
		expect(amounts(rowAt(projection, "2026-01-31"))).toEqual({ cash: 0, savings: 1_300 })
	})

	it("reports a negative result as data, at the Flow's derive path and date", () => {
		const negative: Derive = {
			measures: [
				{ id: "many", op: "const", value: 20 },
				{ id: "few", op: "const", value: 10 },
				{ id: "result", op: "sub", a: "few", b: "many" },
			],
			result: "result",
		}
		expect(
			problems(
				setup([derivedIncome("bad", negative, { start: "2026-01-31" })], {
					horizon: "2026-01-31",
				}),
			),
		).toEqual([
			{ code: "NEGATIVE_AMOUNT", path: ["scenario", "flows", 0, "derive"], date: "2026-01-31" },
		])
	})

	it("reports an unsafe result as an overflow at the date", () => {
		const big = Number.MAX_SAFE_INTEGER
		const overflow: Derive = {
			measures: [
				{ id: "source", op: "flow", flow: "salary" },
				{ id: "result", op: "scale", of: "source", num: 2, den: 1, rounding: "halfUp" },
			],
			result: "result",
		}
		expect(
			problems(
				setup([
					income("salary", big, { start: "2026-01-31" }),
					derivedIncome("double", overflow, { start: "2026-01-31" }),
				]),
			),
		).toEqual([{ code: "VALUE_OVERFLOW", date: "2026-01-31" }])
	})

	it("returns the Derived problem before a Settlement on the same date", () => {
		const negative: Derive = {
			measures: [{ id: "result", op: "const", value: -5 }],
			result: "result",
		}
		const levy: Levy = {
			id: "due",
			period: { month: 1, day: 1 },
			settlement: { month: 12, day: 31 },
			measures: [{ id: "due", op: "const", value: 10_000_000 }],
			due: "due",
			carryIn: [{ periodStart: "2025-01-01", tallies: [], prepaid: 0 }],
		}
		const fixture = makeFixture(
			setup([derivedIncome("bad", negative, { start: "2026-12-31" })], {
				levy,
				horizon: "2026-12-31",
			}),
		)
		// The 2025 period settles on 2026-12-31 and would run short first; the amount problem wins.
		const result = project(fixture.baseline, fixture.scenario, fixture.timeline)
		expect(result.ok).toBe(false)
		expect(result.ok ? [] : result.problems).toEqual([
			{ code: "NEGATIVE_AMOUNT", path: ["scenario", "flows", 0, "derive"], date: "2026-12-31" },
		])
	})
})
