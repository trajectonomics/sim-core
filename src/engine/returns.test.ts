import { describe, expect, it } from "bun:test"
import type { Fixture } from "../fixtures/fixture"
import { mutate } from "./mutate"
import { resolveReturns } from "./return-rows"
import type { Returns } from "./returns"
import { createStates } from "./state"
import { makeFixture } from "./test-helpers"
import { valuation } from "./value"

const series: Returns = {
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

function fixture(start: string = "2023-01-01", horizon: string = "2024-01-01"): Fixture {
	return makeFixture({
		accounts: [{ id: "cash", kind: "asset", rate: 5000 }],
		balances: { cash: 100000 },
		flows: [],
		surplus: [{ account: "cash" }],
		start,
		horizon,
	})
}

function stateAt(fix: Fixture, input: Returns = series) {
	const states = createStates(
		fix.baseline,
		fix.scenario,
		fix.timeline.start,
		resolveReturns(input, fix.timeline),
	)
	return states.get("cash")!
}

describe("Return series resolution", () => {
	it("fixes each row's window and day count at run start", () => {
		const rows = resolveReturns(series, fixture().timeline).get("cash")
		expect(rows?.map((row) => [row.from, row.to, row.days])).toEqual([
			["2023-01-01", "2023-06-30", 180],
			["2023-06-30", "2024-01-01", 185],
		])
	})

	it("gives a Feb 28 row no counted days when the leap day is not counted", () => {
		const leap = fixture("2028-02-28", "2028-03-01")
		const input: Returns = {
			returnsVersion: 1,
			series: [
				{
					account: "cash",
					rows: [
						{ from: "2028-02-28", returnBps: 5000 },
						{ from: "2028-02-29", returnBps: 0 },
					],
				},
			],
		}
		const days = resolveReturns(input, leap.timeline)
			.get("cash")
			?.map((row) => row.days)
		expect(days).toEqual([0, 1])
		expect(valuation(stateAt(leap, input), "2028-03-01")).toBe(100000n)
	})
})

describe("valuation over a Return series", () => {
	it("holds 90 of a row's 180 counted days", () => {
		// 100,000 × (10,000×180 + 1,000×90) / (10,000×180) = 105,000
		expect(valuation(stateAt(fixture()), "2023-04-01")).toBe(105000n)
	})

	it("reaches the whole first row at its end", () => {
		// 100,000 × 11,000 / 10,000 = 110,000
		expect(valuation(stateAt(fixture()), "2023-06-30")).toBe(110000n)
	})

	it("walks both rows to the horizon", () => {
		// 110,000 × 10,800 / 10,000 = 118,800
		expect(valuation(stateAt(fixture()), "2024-01-01")).toBe(118800n)
	})

	it("replaces the Account's rate for the dates the series covers", () => {
		// A 5,000 bps rate would give 150,000; the series wins.
		expect(valuation(stateAt(fixture()), "2024-01-01")).toBe(118800n)
	})

	it("rounds once per held row, so a mid-row commit adds the r² term", () => {
		const state = stateAt(fixture())
		expect(mutate(state, "2023-04-01", 0n, undefined)).toBeUndefined()
		// The commit at 2023-04-01 carries 105,000; the second half is 105,000 × 1.05 = 110,250.
		expect(valuation(state, "2023-06-30")).toBe(110250n)
		// r²·h₁h₂/D² = 0.01 × 0.25 = 0.0025, so 100,000 × 0.0025 = 250 above 110,000.
		const split = valuation(state, "2023-06-30") - valuation(stateAt(fixture()), "2023-06-30")
		expect(split).toBe(250n)
	})
})
