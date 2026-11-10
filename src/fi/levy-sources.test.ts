import { describe, expect, it } from "bun:test"
import { project } from "../engine/project"
import { expense, income } from "../engine/test-flows"
import { emptyCarryIn, makeFixture, withCarryIn } from "../engine/test-helpers"
import type { Fixture } from "../fixtures/fixture"
import { oracleCutFlows } from "../golden/oracle-fi"
import type { Levy } from "../types"
import { scanPattern } from "./scan-probe"

const sourceLevy: Levy = withCarryIn(
	{
		id: "returns",
		period: { month: 1, day: 1 },
		settlement: { month: 6, day: 30 },
		measures: [
			{ id: "interest", op: "tally", label: "interest", basis: "returns" },
			{ id: "zero", op: "const", value: 0 },
		],
		due: "zero",
	},
	emptyCarryIn("2025-01-01"),
)

export function sourceFixture(): Fixture {
	return makeFixture({
		accounts: [
			{ id: "cash", kind: "asset", rate: 0 },
			{ id: "deposit", kind: "asset", rate: 1000, returnLabel: "interest" },
		],
		balances: { cash: 100_000, deposit: 100_000 },
		flows: [
			income("salary", 10_000, { frequency: "monthly" }),
			expense("living", 9_000, { frequency: "monthly" }),
		],
		surplus: [{ account: "cash" }],
		withdraw: ["cash", "deposit"],
		start: "2026-01-01",
		horizon: "2029-06-30",
		resolution: "month",
		levy: sourceLevy,
	})
}

/** The same Scenario with earned income stopped before `month`, as the scan's candidate does. */
function rewritten(fixture: Fixture, month: string): Fixture {
	const flows = fixture.scenario.flows.flatMap((flow) =>
		flow.kind === "income" && flow.earned ? oracleCutFlows(flow, month, undefined) : [flow],
	)
	return { ...fixture, scenario: { ...fixture.scenario, flows } }
}

describe("the FI scan with a labelled Account", () => {
	it("passes and fails each candidate exactly like a full Projection", () => {
		const fixture = sourceFixture()
		const pattern = scanPattern(fixture, { method: "survival" })
		const naive = pattern.months.map((month) => {
			const { baseline, scenario, timeline } = rewritten(fixture, month)
			const result = project(baseline, scenario, timeline)
			return result.ok && result.projection.runsOut === undefined ? "pass" : "fail"
		})
		expect(pattern.months.length).toBeGreaterThan(12)
		expect(pattern.results).toEqual(naive)
	})
})
