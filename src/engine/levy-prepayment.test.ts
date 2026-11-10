import { describe, expect, it } from "bun:test"
import type { BasisPoints, Levy, MinorUnits } from "../types"
import { income, prepays } from "./test-flows"
import { amounts, emptyCarryIn, periodFrom, rowAt, run, withCarryIn } from "./test-helpers"

const levy: Levy = withCarryIn(
	{
		id: "zero",
		period: { month: 1, day: 1 },
		settlement: { month: 3, day: 31 },
		measures: [{ id: "due", op: "const", value: 0 }],
		due: "due",
	},
	emptyCarryIn("2025-01-01"),
)

function prepaidFor(amount: MinorUnits, prepaymentBps: BasisPoints) {
	const projection = run({
		accounts: [{ id: "cash", kind: "asset", rate: 0 }],
		balances: { cash: 0 },
		flows: [income("pay", amount, { prepayments: prepays("zero", prepaymentBps) })],
		surplus: [{ account: "cash" }],
		withdraw: ["cash"],
		start: "2026-01-01",
		horizon: "2026-01-01",
		levy,
	})
	return {
		prepaid: periodFrom(projection, "2026-01-01").prepaid,
		net: amounts(rowAt(projection, "2026-01-01"))["cash"],
	}
}

describe("Prepayment rounding", () => {
	it("rounds a half up in minor units", () => {
		expect(prepaidFor(1, 5000)).toEqual({ prepaid: 1, net: 0 })
		expect(prepaidFor(101, 5000)).toEqual({ prepaid: 51, net: 50 })
	})

	it("rounds a fraction below half down", () => {
		expect(prepaidFor(1, 4999)).toEqual({ prepaid: 0, net: 1 })
	})

	it("takes nothing at 0 bps and everything at 10000 bps", () => {
		expect(prepaidFor(123, 0)).toEqual({ prepaid: 0, net: 123 })
		expect(prepaidFor(123, 10_000)).toEqual({ prepaid: 123, net: 0 })
	})
})
