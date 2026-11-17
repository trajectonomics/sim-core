import { describe, expect, it } from "bun:test"
import { thaiEmployee } from "../fixtures/thai-employee"
import { expected } from "../testing"
import type { CarryIn, Levy, TallyBasis } from "../types"
import { checkWith, flowsThen, flowsWith, LEVY } from "./levy-fixture"

const at = (index = 0) => ["scenario", "levies", index] as const

const base = LEVY as Levy
const unlabelled = thaiEmployee.scenario.flows

/** The shared Levy, with a `due` graph that is one `tally` Measure reading `label` / `basis`. */
function tallyLevy(label: string, basis: TallyBasis, id = "levy"): Levy {
	return { ...base, id, measures: [{ id: "due", op: "tally", label, basis }], due: "due" }
}

function other(levy: Levy): Levy {
	return { ...levy, id: "other", settlement: { month: 4, day: 30 } }
}

/** A Carry-in record for one Settlement period start, with the given tallies. */
function record(periodStart: string, label?: string, basis: TallyBasis = "gross"): CarryIn {
	const tallies = label === undefined ? [] : [{ label, basis, amount: 1000 }]
	return { periodStart, tallies, prepaid: 0 }
}

describe("check() Levy tally supply", () => {
	it("refuses a Levy whose due graph reads a label no Flow supplies", () => {
		expect(checkWith({ levy: LEVY, flows: unlabelled })).toEqual(
			expected("UNSUPPLIED_TALLY_LABEL", at()),
		)
	})

	it("refuses only the Levy whose graph nothing supplies", () => {
		const supplied = tallyLevy("salary", "gross")
		const flows = flowsWith(0, { label: "salary" })
		expect(checkWith({ levies: [supplied, other(tallyLevy("rent", "gross"))], flows })).toEqual(
			expected("UNSUPPLIED_TALLY_LABEL", at(1)),
		)
	})

	it("accepts a graph that reads an unsupplied tally beside a supplied one", () => {
		const measures = [
			{ id: "a", op: "tally", label: "salary", basis: "gross" },
			{ id: "b", op: "tally", label: "rmf", basis: "funded" },
			{ id: "due", op: "add", a: "a", b: "b" },
		] as const
		const levy = { ...base, measures, due: "due" }
		expect(checkWith({ levy, flows: flowsWith(0, { label: "salary" }) })).toEqual([])
	})

	it("accepts a Levy supplied by its Carry-in alone", () => {
		const levy = { ...tallyLevy("salary", "gross"), carryIn: [record("2025-01-01", "salary")] }
		expect(checkWith({ levy, flows: unlabelled })).toEqual([])
	})

	it("does not count a Carry-in record for a period that starts on the Timeline start", () => {
		const levy = {
			...tallyLevy("salary", "gross"),
			carryIn: [record("2025-01-01"), record("2026-01-01", "salary")],
		}
		expect(checkWith({ levy, flows: unlabelled })).toEqual(expected("UNSUPPLIED_TALLY_LABEL", at()))
	})

	it("accepts an Account returnLabel as supply with unlabelled income Flows", () => {
		const accounts = thaiEmployee.scenario.accounts.map((account, index) =>
			index === 0 ? { ...account, returnLabel: "interest" } : account,
		)
		expect(
			checkWith({ levy: tallyLevy("interest", "returns"), accounts, flows: unlabelled }),
		).toEqual([])
	})

	it("accepts an Account gainLabel as supply with unlabelled income Flows", () => {
		const brokerage = { id: "brokerage", kind: "asset", rate: 0, gainLabel: "gain" } as const
		const accounts = [...thaiEmployee.scenario.accounts, brokerage]
		expect(checkWith({ levy: tallyLevy("gain", "gains"), accounts, flows: unlabelled })).toEqual([])
	})

	it("accepts a const-only due, which reads no tally", () => {
		const levy = { ...base, measures: [{ id: "due", op: "const", value: 0 }], due: "due" }
		expect(checkWith({ levy, flows: unlabelled })).toEqual([])
	})

	it("accepts a Flow label only a cappedPrepayment reads beside a supplied tally", () => {
		const capped = { levy: "levy", bps: 620, upTo: "cap" }
		const flows = flowsThen(flowsWith(1, { label: "salary" }), 0, {
			label: "untallied",
			cappedPrepayment: capped,
		})
		expect(checkWith({ levy: LEVY, flows })).toEqual([])
	})

	it("reports only MEASURE_CYCLE on a cyclic graph that reads a supplied tally", () => {
		const measures = [
			{ id: "tally", op: "tally", label: "salary", basis: "gross" },
			{ id: "loop", op: "add", a: "loop", b: "tally" },
		] as const
		const levy = { ...base, measures, due: "loop" }
		expect(checkWith({ levy, flows: flowsWith(0, { label: "salary" }) })).toEqual(
			expected("MEASURE_CYCLE", ["scenario", "levies", 0, "measures", 1, "a"]),
		)
	})
})
