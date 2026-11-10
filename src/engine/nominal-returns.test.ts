import { describe, expect, it } from "bun:test"
import type { Fixture } from "../fixtures/fixture"
import type { Account } from "../types"
import type { Returns } from "./returns"
import { runEngine } from "./run"
import { income } from "./test-flows"
import { makeFixture } from "./test-helpers"

const returns: Returns = {
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

const observations: readonly string[] = [
	"2023-03-10",
	"2023-03-15",
	"2023-06-30",
	"2023-12-31",
	"2024-01-01",
]

function fixtureWith(compounding: boolean): Fixture {
	const account: Account = {
		id: "cash",
		kind: "asset",
		rate: 5000,
		...(compounding ? { compounding: "monthly" as const } : {}),
	}
	return makeFixture({
		accounts: [account],
		balances: { cash: 100_000 },
		flows: [income("bonus", 50_000, { start: "2023-03-10" })],
		surplus: [{ account: "cash" }],
		start: "2023-01-01",
		horizon: "2024-01-01",
	})
}

function balances(compounding: boolean): readonly (readonly [string, number])[] {
	const fixture = fixtureWith(compounding)
	const result = runEngine(
		fixture.baseline,
		fixture.scenario,
		fixture.timeline,
		observations,
		returns,
	)
	if (!result.ok) throw new Error(JSON.stringify(result.problem))
	return result.run.snapshots.map((snapshot) => [
		snapshot.date,
		Number(snapshot.balances[0]!.amount),
	])
}

describe("a Return series replaces the rate", () => {
	it("suspends nominal compounding, so a series-only Account and a nominal one agree", () => {
		expect(balances(true)).toEqual(balances(false))
	})
})
