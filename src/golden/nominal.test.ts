import { describe, expect, it } from "bun:test"
import { compoundingDate } from "../calendar/compounding"
import { project } from "../engine/project"
import type { Fixture } from "../fixtures/fixture"
import type { Account } from "../types"
import type { Projection, ProjectionRow } from "../types/projection"
import {
	NOMINAL_CASES,
	nominalAnnual,
	nominalLeapFebruary,
	nominalQuarterly,
	nominalZero,
} from "./nominal-cases"
import { EDGE_NOMINAL_CASES } from "./nominal-edge-cases"
import { FLOW_NOMINAL_CASES } from "./nominal-flow-cases"
import { oracleView } from "./oracle-view"

const ALL_CASES: readonly Fixture[] = [
	...NOMINAL_CASES,
	...FLOW_NOMINAL_CASES,
	...EDGE_NOMINAL_CASES,
]

function projectFixture(fixture: Fixture): Projection {
	const result = project(fixture.baseline, fixture.scenario, fixture.timeline)
	if (!result.ok) throw new Error(JSON.stringify(result.problems))
	return result.projection
}

describe("nominal fixtures match the independent oracle", () => {
	for (const [index, fixture] of ALL_CASES.entries()) {
		it(`case ${index + 1} matches rows, roll-ups and runs-out`, () => {
			const projection = projectFixture(fixture)
			const view = oracleView(
				fixture,
				projection.rows.map((row) => row.date),
			)
			expect(projection.rows).toEqual(view.rows)
			expect(projection.runsOut).toEqual(view.runsOut)
			expect(projection.annual).toEqual(view.annual)
			expect(projection.unfundedContributions).toEqual(view.unfundedContributions)
		})
	}
})

/** Effective Accounts, and nominal Accounts on a compounding date, report no accrued interest. */
function mustBeZero(rule: Account, date: string): boolean {
	if (rule.compounding === undefined) return true
	return compoundingDate(date, rule.compounding) === date
}

type Balance = ProjectionRow["balances"][number]

function signedSum(balances: readonly Balance[], kinds: ReadonlyMap<string, string>): number {
	return balances.reduce(
		(sum, item) => sum + (kinds.get(item.account) === "liability" ? -item.amount : item.amount),
		0,
	)
}

function accessibleSum(
	balances: readonly Balance[],
	accounts: ReadonlyMap<string, Account>,
	date: string,
): number {
	return balances.reduce((sum, item) => {
		const rule = accounts.get(item.account)!
		const locked =
			rule.kind === "asset" && rule.lockedUntil !== undefined && date < rule.lockedUntil
		return locked ? sum : sum + (rule.kind === "liability" ? -item.amount : item.amount)
	}, 0)
}

function expectAccruedZeroOnBoundaries(fixture: Fixture): void {
	const projection = projectFixture(fixture)
	const accounts = new Map(fixture.scenario.accounts.map((rule) => [rule.id, rule]))
	expect(projection.rows[0]!.balances.every((item) => item.accruedInterest === 0)).toBe(true)
	for (const row of projection.rows) {
		for (const balance of row.balances) {
			const rule = accounts.get(balance.account)!
			if (mustBeZero(rule, row.date)) expect(balance.accruedInterest).toBe(0)
		}
	}
}

describe("split invariants", () => {
	it("holds capitalised + accruedInterest = amount on every nominal and real row", () => {
		for (const fixture of ALL_CASES) {
			const projection = projectFixture(fixture)
			for (const row of projection.rows) {
				for (const balance of [...row.balances, ...row.realBalances]) {
					expect(balance.capitalised + balance.accruedInterest).toBe(balance.amount)
					expect(balance.amount).toBeGreaterThanOrEqual(0)
				}
			}
		}
	})

	it("reports zero accrued on the opening row and on every compounding date", () => {
		for (const fixture of ALL_CASES) expectAccruedZeroOnBoundaries(fixture)
	})

	it("keeps net worth equal to the signed sum of amounts", () => {
		for (const fixture of ALL_CASES) {
			const projection = projectFixture(fixture)
			const kinds = new Map(fixture.scenario.accounts.map((rule) => [rule.id, rule.kind]))
			const accounts = new Map(fixture.scenario.accounts.map((rule) => [rule.id, rule]))
			for (const row of projection.rows) {
				expect(row.netWorth).toBe(signedSum(row.balances, kinds))
				expect(row.realNetWorth).toBe(signedSum(row.realBalances, kinds))
				expect(row.accessibleNetWorth).toBe(accessibleSum(row.balances, accounts, row.date))
				expect(row.realAccessibleNetWorth).toBe(accessibleSum(row.realBalances, accounts, row.date))
			}
		}
	})

	it("computes a quiet Account's roll-up interest as the change in its value", () => {
		for (const fixture of [nominalQuarterly, nominalAnnual, nominalZero, nominalLeapFebruary]) {
			for (const year of projectFixture(fixture).annual) {
				expect(year.interest).toBe(year.closingNetWorth - year.openingNetWorth)
			}
		}
	})
})
