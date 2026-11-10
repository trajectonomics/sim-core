import { describe, expect, it } from "bun:test"
import { buildEvents } from "./events"
import { processDate } from "./occurrence"
import { resolveReturns } from "./return-rows"
import type { Returns } from "./returns"
import { createStates } from "./state"
import { expense } from "./test-flows"
import { makeFixture } from "./test-helpers"

const fixture = makeFixture({
	accounts: [{ id: "cash", kind: "asset", rate: 1000 }],
	balances: { cash: 100000 },
	flows: [expense("rent", 10000, { start: "2023-06-30" })],
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	start: "2023-01-01",
	horizon: "2024-01-01",
})

const sampled: Returns = {
	returnsVersion: 1,
	series: [
		{
			account: "cash",
			rows: [
				{ from: "2023-01-01", returnBps: 1000 },
				{ from: "2023-06-30", returnBps: 800 },
			],
		},
	],
}

const EVENTS = buildEvents(fixture.scenario, fixture.timeline, undefined).filter(
	(event) => event.date === "2023-06-30",
)

const TOTALS = {
	date: "2023-06-30",
	income: 0n,
	expense: 10000n,
	contributions: 0n,
	unfunded: new Map(),
	levy: 0n,
}

/** #6's second acceptance seed: one `processDate` takes both kinds of state map. */
describe("the seam spike", () => {
	it("processes an Occurrence with and without a Return series", () => {
		const step: typeof processDate = processDate
		const plain = createStates(fixture.baseline, fixture.scenario, fixture.timeline.start)
		const series = createStates(
			fixture.baseline,
			fixture.scenario,
			fixture.timeline.start,
			resolveReturns(sampled, fixture.timeline),
		)

		const plainDay = step(plain, fixture.scenario, "2023-06-30", EVENTS, undefined)
		const seriesDay = step(series, fixture.scenario, "2023-06-30", EVENTS, undefined)

		expect(plainDay?.problem).toBeUndefined()
		expect(seriesDay?.problem).toBeUndefined()
		expect(plainDay?.totals).toEqual(TOTALS)
		expect(seriesDay?.totals).toEqual(TOTALS)

		// The series commits the whole first row: 110,000 − 10,000 = 100,000. A 1,000 bps rate
		// over the same 180 counted days is not a 1,000 bps span return, so the plain run differs.
		expect(series.get("cash")?.balance).toBe(100000n)
		expect(plain.get("cash")?.balance).not.toBe(100000n)
		expect(plain.get("cash")?.asOf).toBe("2023-06-30")
		expect(series.get("cash")?.asOf).toBe("2023-06-30")
	})
})
