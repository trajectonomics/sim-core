import { describe, expect, it } from "bun:test"
import type { ConstStep, DateString, Levy, MinorUnits } from "../types"
import { run } from "./test-helpers"

const empty = (periodStart: string) => ({ periodStart, tallies: [], prepaid: 0 })

/** A calendar-year Levy owing a stepped constant, settling on the next 31 March. */
function stepped(value: MinorUnits, steps?: readonly ConstStep[]): Levy {
	return {
		id: "stepped",
		period: { month: 1, day: 1 },
		settlement: { month: 3, day: 31 },
		measures: [{ id: "due", op: "const", value, ...(steps === undefined ? {} : { steps }) }],
		due: "due",
		carryIn: [empty("2025-01-01")],
	}
}

function dueAt(levy: Levy, from: DateString, horizon: string): MinorUnits | undefined {
	const projection = run({
		accounts: [{ id: "cash", kind: "asset", rate: 0 }],
		balances: { cash: 10_000_000 },
		surplus: [{ account: "cash" }],
		withdraw: ["cash"],
		levy,
		horizon,
	})
	return projection.levies?.[0]?.periods.find((period) => period.from === from)?.due
}

describe("Dated constants in the engine", () => {
	it("uses the value before the first step", () => {
		expect(
			dueAt(stepped(100, [{ from: "2027-06-01", value: 500 }]), "2026-01-01", "2026-12-31"),
		).toBe(100)
	})

	it("applies a step inside a Settlement period to the whole period", () => {
		expect(
			dueAt(stepped(100, [{ from: "2026-06-01", value: 500 }]), "2026-01-01", "2026-12-31"),
		).toBe(500)
	})

	it("applies a step on the Settlement period's last day", () => {
		expect(
			dueAt(stepped(100, [{ from: "2026-12-31", value: 500 }]), "2026-01-01", "2026-12-31"),
		).toBe(500)
	})

	it("does not apply a step after the Settlement period", () => {
		expect(
			dueAt(stepped(100, [{ from: "2027-01-01", value: 500 }]), "2026-01-01", "2026-12-31"),
		).toBe(100)
	})

	it("does not reopen a Settlement period for a step before its Settlement", () => {
		const levy = stepped(100, [{ from: "2027-02-01", value: 500 }])
		expect(dueAt(levy, "2026-01-01", "2027-12-31")).toBe(100)
		expect(dueAt(levy, "2027-01-01", "2027-12-31")).toBe(500)
	})

	it("applies a step inside a Carry-in Settlement period", () => {
		expect(
			dueAt(stepped(100, [{ from: "2026-02-01", value: 500 }]), "2026-01-01", "2026-12-31"),
		).toBe(500)
	})

	it("reads the Settlement period's last day even when the horizon cuts it short", () => {
		const levy = stepped(100, [{ from: "2026-09-01", value: 500 }])
		const projection = run({
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			balances: { cash: 10_000_000 },
			surplus: [{ account: "cash" }],
			withdraw: ["cash"],
			levy,
			horizon: "2026-06-30",
		})
		expect(
			projection.levies?.[0]?.periods.find((period) => period.from === "2026-01-01"),
		).toMatchObject({
			partial: true,
			due: 500,
			settled: false,
		})
	})

	it("leaves an unstepped constant and a grown constant unchanged", () => {
		expect(dueAt(stepped(100), "2026-01-01", "2026-12-31")).toBe(100)
		const grown: Levy = {
			...stepped(0),
			measures: [
				{ id: "due", op: "const", value: 100, asOf: "2026-01-01", growth: { bps: 10_000 } },
			],
		}
		// Growth is measured to the Settlement's Due date, so the 2027 period has two whole years.
		expect(dueAt(grown, "2026-01-01", "2028-06-30")).toBe(200)
		expect(dueAt(grown, "2027-01-01", "2028-06-30")).toBe(400)
	})
})
