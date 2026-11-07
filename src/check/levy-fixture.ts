/** TEST-ONLY: a small valid Levy and helpers to run `check()` on edited copies of it. */
import { check } from "../check"
import { thaiEmployee } from "../fixtures/thai-employee"
import { type Edit, edit } from "../testing"
import type { Problem } from "./codes"

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
}

/** `check()` with `levy` (and optionally flow edits) put into the Thai employee scenario. */
export function checkWith(patch: Readonly<Record<string, unknown>>): readonly Problem[] {
	const { baseline, scenario, timeline } = thaiEmployee
	return check(baseline, { ...scenario, ...patch }, timeline)
}

/** `check()` after replacing (or removing) one value inside the valid Levy. */
export function levyProblems(...edits: readonly Edit[]): readonly Problem[] {
	return checkWith({ levy: edits.reduce<unknown>((levy, e) => edit(levy, e), LEVY) })
}

/** Flows of the Thai employee scenario with `change` merged into the flow at `index`. */
export function flowsWith(index: number, change: Readonly<Record<string, unknown>>): unknown[] {
	return thaiEmployee.scenario.flows.map((flow, i) => (i === index ? { ...flow, ...change } : flow))
}
