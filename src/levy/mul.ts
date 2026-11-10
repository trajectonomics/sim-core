import type { Rounding } from "../types"
import { roundedDivide } from "./scale"

/** Exact `a * b / den` rounded as `rounding` says; the product keeps every digit before the divide. */
export function mulValue(a: bigint, b: bigint, den: bigint, rounding: Rounding): bigint {
	return roundedDivide(a * b, den, rounding)
}
