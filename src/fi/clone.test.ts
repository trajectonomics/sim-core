import { describe, expect, it } from "bun:test"
import { createStates } from "../engine/state"
import { makeFixture } from "../engine/test-helpers"
import { cloneLevySet, cloneStates } from "./clone"

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
		original.attributed.set("levy", 5n)
		original.through.set("levy", "2026-06-30")

		const cloned = cloneStates(states)
		const copy = cloned.get("deposit")?.returns
		if (copy === undefined) throw new Error("The clone should track returns")
		expect(copy).not.toBe(original)
		expect(copy.attributed.get("levy")).toBe(5n)
		expect(copy.through.get("levy")).toBe("2026-06-30")

		copy.attributed.set("levy", 9n)
		copy.through.set("levy", "2026-12-31")
		expect(original.attributed.get("levy")).toBe(5n)
		expect(original.through.get("levy")).toBe("2026-06-30")
	})

	it("keeps a scenario without a Levy cloneable", () => {
		expect(cloneLevySet(undefined)).toBeUndefined()
	})
})
