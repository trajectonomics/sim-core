import { nextCompoundingDate, periodCountedDays, periodsPerYear } from "../calendar/compounding"
import { countedDays } from "../calendar/counted"
import type { BasisPoints, CompoundingPeriod, DateString } from "../types"
import { roundHalfUp } from "./round"

/** A nominal Account's exact accrual: capitalised principal plus its principal-days numerator. */
export interface Accrual {
	readonly principal: bigint
	readonly principalDays: bigint
	readonly asOf: DateString
}

export interface NominalRule {
	readonly rate: BasisPoints
	readonly compounding: CompoundingPeriod
}

export interface AccrualParts {
	readonly capitalised: bigint
	readonly accruedInterest: bigint
	readonly amount: bigint
}

/** `10000 × periodsPerYear × periodCountedDays`, the denominator of the period's interest. */
export function accrualDenominator(rule: NominalRule, date: DateString): bigint {
	return (
		10000n *
		BigInt(periodsPerYear(rule.compounding)) *
		BigInt(periodCountedDays(date, rule.compounding))
	)
}

/** Rounds an exact principal-days numerator into minor units, half up. */
export function interestOf(principalDays: bigint, rate: BasisPoints, denominator: bigint): bigint {
	return roundHalfUp(principalDays * BigInt(rate), denominator)
}

/**
 * Capitalises every completed compounding date in `(asOf, date]`. `date` itself is included, so a
 * read on a compounding date reports the period already capitalised; a partial period stays exact.
 */
export function capitaliseThrough(accrual: Accrual, rule: NominalRule, date: DateString): Accrual {
	let principal = accrual.principal
	let principalDays = accrual.principalDays
	let asOf = accrual.asOf
	while (asOf < date) {
		const boundary = nextCompoundingDate(asOf, rule.compounding)
		if (boundary === undefined || boundary > date) break
		principalDays += principal * BigInt(countedDays(asOf, boundary))
		principal += interestOf(principalDays, rule.rate, accrualDenominator(rule, boundary))
		principalDays = 0n
		asOf = boundary
	}
	return { principal, principalDays, asOf }
}

/** Adds principal over the counted days from `asOf` to `date`, without capitalising. */
export function commitThrough(accrual: Accrual, date: DateString): Accrual {
	if (date <= accrual.asOf) return accrual
	const principalDays =
		accrual.principalDays + accrual.principal * BigInt(countedDays(accrual.asOf, date))
	return { principal: accrual.principal, principalDays, asOf: date }
}

/** The value at `date`: completed periods capitalised, the running period's interest rounded. */
export function accrualParts(accrual: Accrual, rule: NominalRule, date: DateString): AccrualParts {
	const settled = capitaliseThrough(accrual, rule, date)
	const running = commitThrough(settled, date)
	const accruedInterest =
		running.principalDays === 0n
			? 0n
			: interestOf(running.principalDays, rule.rate, accrualDenominator(rule, date))
	return {
		capitalised: running.principal,
		accruedInterest,
		amount: running.principal + accruedInterest,
	}
}
