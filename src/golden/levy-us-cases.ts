import { income } from "../engine/test-flows"
import { emptyCarryIn, withCarryIn } from "../engine/test-helpers"
import type { Fixture } from "../fixtures/fixture"
import type { Flow, IncomeFlow, Measure } from "../types"

/** A synthetic US-style fixture: one calendar-year Levy settling on the next 31 March. */
export function usFixture(
	flows: readonly Flow[],
	measures: readonly Measure[],
	due: string,
): Fixture {
	return {
		baseline: { schemaVersion: 1, balances: [{ account: "cash", amount: 0 }] },
		scenario: {
			schemaVersion: 3,
			currency: "USD",
			economy: { inflation: 0 },
			accounts: [{ id: "cash", kind: "asset", rate: 0 }],
			flows,
			cashflow: { surplus: [{ account: "cash" }], contribute: [], withdraw: ["cash"] },
			levy: withCarryIn(
				{
					id: "us-like",
					period: { month: 1, day: 1 },
					settlement: { month: 3, day: 31 },
					measures,
					due,
				},
				emptyCarryIn("2025-01-01"),
			),
		},
		timeline: { start: "2026-01-01", horizon: "2026-12-31", resolution: "month" },
	}
}

/** Monthly income on the 31st, the shape most US payroll screens use. */
export function monthlyIncome(id: string, amount: number, label: string): IncomeFlow {
	return income(id, amount, { frequency: "monthly", start: "2026-01-31", label })
}

/** Care credit: a derived expense base times a rate that falls as AGI rises. */
export const levyCareCredit: Fixture = usFixture(
	[monthlyIncome("salary", 10_000_000, "salary"), monthlyIncome("care", 1_000_000, "care")],
	[
		{ id: "salary", op: "tally", label: "salary", basis: "gross" },
		{ id: "care", op: "tally", label: "care", basis: "gross" },
		{ id: "steps", op: "scale", of: "salary", num: 1, den: 100_000, rounding: "floor" },
		{ id: "ceiling", op: "const", value: 1800 },
		{ id: "rate", op: "sub", a: "ceiling", b: "steps" },
		{ id: "credit", op: "mul", a: "care", b: "rate", den: 10_000, rounding: "halfUp" },
	],
	"credit",
)

const tuition: IncomeFlow = income("tuition", 5_000_000, { start: "2026-02-01", label: "tuition" })

/** AOTC shape: a derived tuition credit times a linearly phased-out factor. */
export const levyAotc: Fixture = usFixture(
	[monthlyIncome("salary", 15_000_000, "salary"), tuition],
	[
		{ id: "salary", op: "tally", label: "salary", basis: "gross" },
		{ id: "tuition", op: "tally", label: "tuition", basis: "gross" },
		{ id: "zero", op: "const", value: 0 },
		{ id: "threshold", op: "const", value: 160_000_000 },
		{ id: "excess", op: "max", a: "above", b: "zero" },
		{ id: "above", op: "sub", a: "salary", b: "threshold" },
		{ id: "steps", op: "scale", of: "excess", num: 1, den: 1_000_000, rounding: "halfUp" },
		{ id: "full", op: "const", value: 10_000 },
		{ id: "factor", op: "sub", a: "full", b: "steps" },
		{ id: "credit", op: "mul", a: "tuition", b: "factor", den: 10_000, rounding: "halfUp" },
	],
	"credit",
)
