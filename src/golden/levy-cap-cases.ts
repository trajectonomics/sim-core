import { income } from "../engine/test-flows"
import type { Fixture } from "../fixtures/fixture"
import type { CappedPrepayment, Measure, MinorUnits } from "../types"
import { usFixture } from "./levy-us-cases"

function cappedSalary(id: string, amount: MinorUnits, label: string, cap: CappedPrepayment) {
	return income(id, amount, {
		frequency: "monthly",
		start: "2026-01-31",
		label,
		cappedPrepayment: cap,
	})
}

/** Social Security shape: 6.2% prepaid only up to a wage base, on a 10,000,000 salary. */
export function wageBaseCase(cap: MinorUnits): Fixture {
	return usFixture(
		[cappedSalary("salary", 10_000_000, "wage", { bps: 620, upTo: "base" })],
		[
			{ id: "base", op: "const", value: cap },
			{ id: "wage", op: "tally", label: "wage", basis: "gross" },
			{ id: "due", op: "const", value: 0 },
		],
		"due",
	)
}

/** An Occurrence that straddles the cap: two whole months, then 5,000,000 of the third. */
export const levyWageBaseStraddle: Fixture = wageBaseCase(25_000_000)

/** Two earners, one label and one cap each, summed with `add`: joint filing needs no primitive. */
export const levyJointFilers: Fixture = usFixture(
	[
		cappedSalary("a-salary", 10_000_000, "person-a", { bps: 620, upTo: "cap-a" }),
		cappedSalary("b-salary", 4_000_000, "person-b", { bps: 620, upTo: "cap-b" }),
	],
	jointMeasures(),
	"due",
)

function jointMeasures(): readonly Measure[] {
	return [
		{ id: "cap-a", op: "const", value: 60_000_000 },
		{ id: "cap-b", op: "const", value: 50_000_000 },
		{ id: "a-gross", op: "tally", label: "person-a", basis: "gross" },
		{ id: "b-gross", op: "tally", label: "person-b", basis: "gross" },
		{ id: "a-due", op: "scale", of: "a-gross", num: 10, den: 100, rounding: "halfUp" },
		{ id: "b-due", op: "scale", of: "b-gross", num: 10, den: 100, rounding: "halfUp" },
		{ id: "due", op: "add", a: "a-due", b: "b-due" },
	]
}
