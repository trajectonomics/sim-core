import { describe, expect, it } from "bun:test"
import { check } from "../check"
import { thaiEmployee } from "../fixtures/thai-employee"
import { expected, problemsFor, REMOVE } from "../testing"
import type { Flow } from "../types"

const contribute = ["cashflow", "contribute"] as const
const contributePath = ["scenario", ...contribute] as const
const { baseline, scenario, timeline } = thaiEmployee

function checkScenario(changes: Partial<typeof scenario>): readonly { code: string }[] {
	return check(baseline, { ...scenario, ...changes }, timeline)
}

describe("check() contribution routing", () => {
	it("requires a contribute list", () => {
		expect(problemsFor({ scenario: [[...contribute], REMOVE] })).toEqual(
			expected("MISSING_KEY", [...contributePath]),
		)
	})

	it("rejects a non-array contribute", () => {
		expect(problemsFor({ scenario: [[...contribute], "rmf"] })).toEqual(
			expected("NOT_AN_ARRAY", [...contributePath]),
		)
	})

	it("flags a hole in contribute", () => {
		const items = new Array<unknown>(2)
		items[1] = "rmf"
		expect(problemsFor({ scenario: [[...contribute], items] })).toEqual(
			expected("WRONG_TYPE", [...contributePath, 0]),
		)
	})

	it("rejects an undeclared contribute account", () => {
		expect(problemsFor({ scenario: [[...contribute], ["rmf", "ghost"]] })).toEqual(
			expected("UNKNOWN_ACCOUNT", [...contributePath, 1]),
		)
	})

	it("rejects a liability in contribute", () => {
		expect(problemsFor({ scenario: [[...contribute], ["rmf", "mortgage"]] })).toEqual(
			expected("LIABILITY_MISUSE", [...contributePath, 1]),
		)
	})

	it("rejects a repeated contribute account", () => {
		expect(problemsFor({ scenario: [[...contribute], ["rmf", "rmf"]] })).toEqual(
			expected("DUPLICATE_ID", [...contributePath, 1]),
		)
	})

	it("accepts an extra contribute account that no flow targets", () => {
		expect(problemsFor({ scenario: [[...contribute], ["rmf", "cash", "emergency-fund"]] })).toEqual(
			[],
		)
	})

	it("accepts an empty contribute list when no asset flow targets an account", () => {
		const flows = scenario.flows.filter(
			(flow) => flow.kind !== "contribution" || flow.target === "mortgage",
		)
		const problems = checkScenario({ flows, cashflow: { ...scenario.cashflow, contribute: [] } })
		expect(problems).toEqual([])
	})

	it("rejects an asset contribution target missing from contribute", () => {
		expect(problemsFor({ scenario: [[...contribute], []] })).toEqual(
			expected("CONTRIBUTION_UNROUTED", ["scenario", "flows", 3, "target"]),
		)
	})

	it("flags an unrouted asset target even when the flow is outside the horizon", () => {
		const flows: readonly Flow[] = [
			...scenario.flows,
			{
				id: "late-save",
				kind: "contribution",
				target: "cash",
				amount: 100,
				frequency: "once",
				start: "2100-01-01",
				growth: { bps: 0 },
			},
		]
		expect(checkScenario({ flows })).toEqual(
			expected("CONTRIBUTION_UNROUTED", ["scenario", "flows", 5, "target"]),
		)
	})

	it("does not require routing for a liability target", () => {
		const flows = scenario.flows.map((flow) =>
			flow.kind === "contribution" && flow.target === "rmf"
				? { ...flow, target: "mortgage" }
				: flow,
		)
		const problems = checkScenario({ flows, cashflow: { ...scenario.cashflow, contribute: [] } })
		expect(problems).toEqual([])
	})
})
