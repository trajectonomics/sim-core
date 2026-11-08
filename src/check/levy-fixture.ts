/** TEST-ONLY: a small valid Levy and helpers to run `check()` on edited copies of it. */

import { check } from "../check"
import { thaiEmployee } from "../fixtures/thai-employee"
import { type Edit, edit } from "../testing"
import type { DateString, Timeline } from "../types"
import type { Problem } from "./codes"
import { isMonthDay } from "./month-day"

export const LEVY: unknown = {
	id: "levy",
	period: { month: 1, day: 1 },
	settlement: { month: 3, day: 31 },
	measures: [
		{ id: "income", op: "tally", label: "salary", basis: "gross" },
		{ id: "cap", op: "const", value: 100_000, asOf: "2026-01-01", growth: { bps: 300 } },
		{ id: "share", op: "scale", of: "income", num: 1, den: 2, rounding: "floor" },
		{ id: "owed", op: "min", a: "share", b: "cap" },
		// biome-ignore lint/suspicious/noThenProperty: `then` is a Measure operand key, not a thenable
		{ id: "pick", op: "pick", a: "income", b: "cap", then: "owed", else: "cap" },
	],
	due: "owed",
	carryIn: [{ periodStart: "2025-01-01", tallies: [], prepaid: 0 }],
}

function periodRuleOf(levy: unknown): unknown {
	if (typeof levy !== "object" || levy === null || !("period" in levy)) return undefined
	return levy.period
}

/** The Timeline start that a Levy's period rule requires, in the fixture's start year. */
function alignedStart(base: DateString, levy: unknown): DateString {
	const period = periodRuleOf(levy)
	if (!isMonthDay(period)) return base
	const year = base.slice(0, 4)
	return `${year}-${String(period.month).padStart(2, "0")}-${String(period.day).padStart(2, "0")}`
}

/** `check()` with `levy`, optional flow edits and optional timeline edits on the Thai employee fixture. */
export function checkWith(
	patch: Readonly<Record<string, unknown>>,
	timelinePatch: Partial<Timeline> = {},
): readonly Problem[] {
	const { baseline, scenario, timeline } = thaiEmployee
	return check(baseline, { ...scenario, ...patch }, { ...timeline, ...timelinePatch })
}

/** An empty Carry-in for the period before the aligned start year. */
function priorCarryIn(levy: unknown): unknown | undefined {
	const period = periodRuleOf(levy)
	if (!isMonthDay(period)) return undefined
	const year = Number(thaiEmployee.timeline.start.slice(0, 4)) - 1
	const month = String(period.month).padStart(2, "0")
	const day = String(period.day).padStart(2, "0")
	return {
		periodStart: `${String(year).padStart(4, "0")}-${month}-${day}`,
		tallies: [],
		prepaid: 0,
	}
}

/**
 * `check()` after replacing (or removing) one value inside the valid Levy, with an aligned start.
 * An empty Carry-in for the prior period is injected; use `checkWith` to test missing records.
 */
export function levyProblems(...edits: readonly Edit[]): readonly Problem[] {
	const edited = edits.reduce<unknown>((value, e) => edit(value, e), LEVY)
	const prior = priorCarryIn(edited)
	const levy = prior === undefined ? edited : { ...(edited as object), carryIn: [prior] }
	return checkWith({ levy }, { start: alignedStart(thaiEmployee.timeline.start, edited) })
}

/** Flows of the Thai employee scenario with `change` merged into the flow at `index`. */
export function flowsWith(index: number, change: Readonly<Record<string, unknown>>): unknown[] {
	return thaiEmployee.scenario.flows.map((flow, i) => (i === index ? { ...flow, ...change } : flow))
}
