import { describe, expect, it } from "bun:test"
import type { ConstMeasure, Growth, Levy, MinorUnits } from "../types"
import { income } from "./test-flows"
import { amounts, emptyCarryIn, periodFrom, rowAt, run, withCarryIn } from "./test-helpers"

/** A calendar-year Levy that owes 0 and holds one `const` the caps name. */
function capLevy(value: MinorUnits, growth?: Growth): Levy {
	const base: ConstMeasure =
		growth === undefined
			? { id: "base", op: "const", value }
			: { id: "base", op: "const", value, asOf: "2026-01-01", growth }
	return withCarryIn(
		{
			id: "wage",
			period: { month: 1, day: 1 },
			settlement: { month: 3, day: 31 },
			measures: [
				base,
				{ id: "gross", op: "tally", label: "wage", basis: "gross" },
				{ id: "due", op: "const", value: 0 },
			],
			due: "due",
		},
		emptyCarryIn("2025-01-01"),
	)
}

const monthlySalary = (bps: number, prepaymentBps?: number) =>
	income("salary", 10_000, {
		frequency: "monthly",
		start: "2026-01-31",
		label: "wage",
		...(prepaymentBps === undefined ? {} : { prepaymentBps }),
		cappedPrepayment: { bps, upTo: "base" },
	})

function project(
	flows: readonly ReturnType<typeof income>[],
	cap: MinorUnits,
	horizon = "2026-12-31",
) {
	return run({
		accounts: [{ id: "cash", kind: "asset", rate: 0 }],
		balances: { cash: 0 },
		flows,
		surplus: [{ account: "cash" }],
		withdraw: ["cash"],
		horizon,
		levy: capLevy(cap),
	})
}

describe("capped Prepayment in the engine", () => {
	it("prepays only the part of an Occurrence below the cap", () => {
		const projection = project([monthlySalary(620)], 25_000)
		// 620 + 620 on the first two months, then 6.2% of the 5,000 that is left: 310.
		expect(periodFrom(projection, "2026-01-01").prepaid).toBe(1_550)
		expect(amounts(rowAt(projection, "2026-12-31"))).toEqual({ cash: 118_450 })
	})

	it("takes both shares on one Flow: the uncapped share keeps going after the cap", () => {
		const projection = project([monthlySalary(620, 145)], 20_000)
		// 145 + 620 twice, then 145 alone for the other ten months once the base is used up.
		expect(periodFrom(projection, "2026-01-01").prepaid).toBe(2_980)
		expect(amounts(rowAt(projection, "2026-12-31"))).toEqual({ cash: 117_020 })
	})

	it("restarts the cap in each Settlement period", () => {
		const projection = project([monthlySalary(620)], 30_000, "2027-12-31")
		expect(periodFrom(projection, "2026-01-01").prepaid).toBe(1_860)
		expect(periodFrom(projection, "2027-01-01").prepaid).toBe(1_860)
	})

	it("counts Carry-in gross toward a cap that started before the Timeline", () => {
		const levy = {
			...capLevy(30_000),
			carryIn: [
				{
					periodStart: "2026-01-01",
					tallies: [{ label: "wage", basis: "gross", amount: 20_000 }],
					prepaid: 1_240,
				},
			],
		} as Levy
		const projection = run({
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			balances: { cash: 0 },
			flows: [monthlySalary(620)],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			start: "2026-06-01",
			horizon: "2026-12-31",
			levy,
		})
		// June is the last 10,000 below 30,000; nothing after it is eligible.
		expect(periodFrom(projection, "2026-01-01").prepaid).toBe(1_860)
	})

	it("prepays nothing when Carry-in gross already reached the cap", () => {
		const levy = {
			...capLevy(30_000),
			carryIn: [
				{
					periodStart: "2026-01-01",
					tallies: [{ label: "wage", basis: "gross", amount: 40_000 }],
					prepaid: 2_480,
				},
			],
		} as Levy
		const projection = run({
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			balances: { cash: 0 },
			flows: [monthlySalary(620)],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			start: "2026-06-01",
			horizon: "2026-12-31",
			levy,
		})
		expect(periodFrom(projection, "2026-01-01").prepaid).toBe(2_480)
	})

	it("lets the earlier Flow id use the room first when two Flows share a label", () => {
		const flows = [
			income("a", 10_000, {
				start: "2026-01-31",
				label: "wage",
				cappedPrepayment: { bps: 620, upTo: "wide" },
			}),
			income("b", 10_000, {
				start: "2026-01-31",
				label: "wage",
				cappedPrepayment: { bps: 620, upTo: "narrow" },
			}),
		]
		const levy = withCarryIn(
			{
				...capLevy(0),
				measures: [
					{ id: "wide", op: "const", value: 12_000 },
					{ id: "narrow", op: "const", value: 5_000 },
					{ id: "due", op: "const", value: 0 },
				],
			},
			emptyCarryIn("2025-01-01"),
		)
		const projection = run({
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			balances: { cash: 0 },
			flows,
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2026-01-31",
			levy,
		})
		// a fills 10,000 of its 12,000; b finds its 5,000 already passed.
		expect(periodFrom(projection, "2026-01-01").prepaid).toBe(620)
	})

	it("grows the cap to the Settlement's Due date", () => {
		const levy = capLevy(30_000, { bps: 1000 })
		const projection = run({
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			balances: { cash: 0 },
			flows: [monthlySalary(620)],
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			horizon: "2026-12-31",
			levy,
		})
		// 2026 settles on 2027-03-31, one whole year from asOf: 30,000 * 1.1 = 33,000; 6.2% of it is 2,046.
		expect(periodFrom(projection, "2026-01-01").prepaid).toBe(2_046)
	})
})
