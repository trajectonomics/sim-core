import type { Rounding } from "../types"

function away(quotient: bigint, remainder: bigint): bigint {
	return remainder < 0n ? quotient - 1n : quotient + 1n
}

/** Exact `value * num / den` (`den` at least 1) rounded as `rounding` says; ties go away from zero. */
export function scaleValue(value: bigint, num: bigint, den: bigint, rounding: Rounding): bigint {
	const product = value * num
	const quotient = product / den
	const remainder = product % den
	if (remainder === 0n) return quotient
	if (rounding === "floor") return remainder < 0n ? quotient - 1n : quotient
	if (rounding === "ceil") return remainder > 0n ? quotient + 1n : quotient
	const twice = remainder < 0n ? -remainder * 2n : remainder * 2n
	return twice >= den ? away(quotient, remainder) : quotient
}
