import { describe, expect, it } from "bun:test"
import { createStates } from "../engine/state"
import { makeFixture } from "../engine/test-helpers"
import { ruleOfThumb } from "./reference"
import { referencePlan } from "./reference-plan"

const emptyWindow = { ok: true as const, window: { dates: [], cumulative: [0n] } }

const fixture = makeFixture({
	accounts: [{ id: "deposit", kind: "asset", rate: 1200, compounding: "monthly" }],
	balances: { deposit: 100_000 },
	surplus: [{ account: "deposit" }],
	start: "2026-01-01",
	horizon: "2026-12-31",
})

describe("the 25× reference beside a reachable month", () => {
	it("reads a nominal Account without moving its capitalisation clock", () => {
		const states = createStates(fixture.baseline, fixture.scenario, fixture.timeline.start)
		const state = states.get("deposit")
		if (state === undefined) throw new Error("Missing deposit")
		const plan = referencePlan(
			undefined,
			fixture.scenario,
			fixture.timeline,
			emptyWindow,
			undefined,
		)
		expect(ruleOfThumb(states, "2026-06-30", plan).ok).toBe(true)
		expect(state.asOf).toBe("2026-01-01")
		expect(state.balance).toBe(100_000n)
	})
})
