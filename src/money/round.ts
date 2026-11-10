/** Half-up rounding of a non-negative integer ratio. */
export function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
	if (numerator < 0n) throw new RangeError("roundHalfUp expects a non-negative numerator")
	if (denominator <= 0n) throw new RangeError("roundHalfUp expects a positive denominator")
	const quotient = numerator / denominator
	const remainder = numerator - quotient * denominator
	return remainder * 2n >= denominator ? quotient + 1n : quotient
}
