/** TEST-ONLY hand-written Levy with the shape of a progressive income rule (amounts in satang). */
import type { Levy, Measure } from "../types"

/** `scale(min(max(net - lo, 0), width), rate, 100, halfUp)`: the part of `net` inside one band. */
function slice(n: number, lo: number, width: number, percent: number): readonly Measure[] {
	return [
		{ id: `lo${n}`, op: "const", value: lo },
		{ id: `width${n}`, op: "const", value: width },
		{ id: `above${n}`, op: "sub", a: "net", b: `lo${n}` },
		{ id: `inside${n}`, op: "max", a: `above${n}`, b: "zero" },
		{ id: `capped${n}`, op: "min", a: `inside${n}`, b: `width${n}` },
		{ id: `slice${n}`, op: "scale", of: `capped${n}`, num: percent, den: 100, rounding: "halfUp" },
	]
}

const SLICES = [
	...slice(1, 15_000_000, 15_000_000, 5),
	...slice(2, 30_000_000, 20_000_000, 10),
	...slice(3, 50_000_000, 25_000_000, 15),
	...slice(4, 75_000_000, 25_000_000, 20),
]

export const TH_LIKE: Levy = {
	id: "th-like",
	period: { month: 1, day: 1 },
	settlement: { month: 3, day: 31 },
	due: "owed",
	measures: [
		{ id: "zero", op: "const", value: 0 },
		{ id: "income", op: "tally", label: "salary", basis: "gross" },
		{ id: "saved", op: "tally", label: "fund", basis: "funded" },
		// 50% of income, floored to whole units (100 satang), capped at 100,000.00.
		{ id: "half", op: "scale", of: "income", num: 1, den: 2, rounding: "floor" },
		{ id: "halfUnits", op: "scale", of: "half", num: 1, den: 100, rounding: "floor" },
		{ id: "halfWhole", op: "scale", of: "halfUnits", num: 100, den: 1, rounding: "floor" },
		{ id: "expenseCap", op: "const", value: 10_000_000 },
		{ id: "deduction", op: "min", a: "halfWhole", b: "expenseCap" },
		// Allowance: what was saved, capped at 15% of income and at 500,000.00.
		{ id: "allowanceShare", op: "scale", of: "income", num: 15, den: 100, rounding: "floor" },
		{ id: "allowanceCeiling", op: "const", value: 50_000_000 },
		{ id: "allowanceByShare", op: "min", a: "saved", b: "allowanceShare" },
		{ id: "allowance", op: "min", a: "allowanceByShare", b: "allowanceCeiling" },
		{ id: "personal", op: "const", value: 6_000_000 },
		{ id: "afterDeduction", op: "sub", a: "income", b: "deduction" },
		{ id: "afterAllowance", op: "sub", a: "afterDeduction", b: "allowance" },
		{ id: "net", op: "sub", a: "afterAllowance", b: "personal" },
		...SLICES,
		{ id: "s12", op: "add", a: "slice1", b: "slice2" },
		{ id: "s123", op: "add", a: "s12", b: "slice3" },
		{ id: "owed", op: "add", a: "s123", b: "slice4" },
	],
}
