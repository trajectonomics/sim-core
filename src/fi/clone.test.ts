import { describe, expect, it } from "bun:test"
import { createStates } from "../engine/state"
import { makeFixture } from "../engine/test-helpers"
import { cloneStates, cloneTracker } from "./clone"

const fixture = makeFixture({
	accounts: [
		{ id: "cash", kind: "asset", rate: 0 },
		{ id: "deposit", kind: "asset", rate: 500, returnLabel: "interest" },
	],
	balances: { cash: 100, deposit: 1_000 },
	surplus: [{ account: "cash" }],
	start: "2026-01-01",
})

describe("the FI candidate clone", () => {
	it("copies each Account's returns ledger so the clone is independent", () => {
		const states = createStates(fixture.baseline, fixture.scenario, fixture.timeline.start)
		const original = states.get("deposit")?.returns
		if (original === undefined) throw new Error("The deposit should track returns")
		original.attributed = 5n
		original.through = "2026-06-30"

		const cloned = cloneStates(states)
		const copy = cloned.get("deposit")?.returns
		expect(copy).toEqual({ label: "interest", attributed: 5n, through: "2026-06-30" })
		expect(copy).not.toBe(original)

		if (copy !== undefined) copy.attributed = 9n
		expect(original.attributed).toBe(5n)
	})

	it("keeps a scenario without a Levy cloneable", () => {
		expect(cloneTracker(undefined)).toBeUndefined()
	})
})
