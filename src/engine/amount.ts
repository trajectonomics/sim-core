import { grow } from "../money/growth"
import type { BasisPoints, FixedAmount, Flow } from "../types"

export type FixedFlow = Flow & FixedAmount

/** A fixed Flow's amount at an occurrence, grown from the original by whole annual steps. */
export function fixedAmountAt(flow: FixedFlow, years: number, inflation: BasisPoints): bigint {
	const growth = flow.growth
	const rate = growth === "inflation" ? inflation : growth.bps
	return grow(BigInt(flow.amount), rate, years * 365)
}
