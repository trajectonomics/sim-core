/** Independent expectations for the two Levy tally sources; no engine, money or calendar import. */
import type { BasisPoints, DateString } from "../types"
import { oracleCountedDays } from "./oracle-date"
import { oracleGrow } from "./oracle-money"

/** Growth from one fixed base through `through`, less the growth earlier reads already took. */
export function oracleReturnPiece(
	base: bigint,
	rate: BasisPoints,
	baseDate: DateString,
	through: DateString,
	attributed: bigint,
): bigint {
	return oracleGrow(base, rate, oracleCountedDays(baseDate, through)) - base - attributed
}

/** The realised gain of a withdrawal against average cost, rounded half up and capped. */
export function oracleGain(basis: bigint, withdrawn: bigint, valueBefore: bigint): bigint {
	if (valueBefore === 0n) return withdrawn
	const share = (basis * withdrawn * 2n + valueBefore) / (valueBefore * 2n)
	const taken = share > basis ? basis : share
	return withdrawn - taken
}
