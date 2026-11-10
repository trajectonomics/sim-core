import type { Account, BasisPoints, CompoundingPeriod, DateString } from "../types"
import { oracleAddDays, oracleLeap } from "./oracle-date"

/** Months per period, duplicated on purpose: the oracle shares no calendar code with the engine. */
const MONTHS: Readonly<Record<CompoundingPeriod, number>> = {
	monthly: 1,
	quarterly: 3,
	semiannual: 6,
	annual: 12,
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

export interface OracleNominalRule {
	readonly rate: BasisPoints
	readonly compounding: CompoundingPeriod
}

export interface OracleAccrual {
	readonly capitalised: bigint
	readonly numerator: bigint
	readonly asOf: DateString
}

export interface OracleValueParts {
	readonly capitalised: bigint
	readonly accruedInterest: bigint
	readonly amount: bigint
}

export function oracleNominalRule(rule: Account): OracleNominalRule | undefined {
	return rule.compounding === undefined
		? undefined
		: { rate: rule.rate, compounding: rule.compounding }
}

function parse(date: DateString): readonly [number, number, number] {
	return date.split("-").map(Number) as [number, number, number]
}

function monthDays(year: number, month: number): number {
	return month === 2 && oracleLeap(year) ? 29 : (MONTH_DAYS[month - 1] ?? 0)
}

function periodStart(date: DateString, period: CompoundingPeriod): DateString {
	const [year, month] = parse(date)
	const first = month - ((month - 1) % MONTHS[period])
	return `${String(year).padStart(4, "0")}-${String(first).padStart(2, "0")}-01`
}

function compoundingDate(date: DateString, period: CompoundingPeriod): DateString {
	const [year, month] = parse(date)
	const last = month - ((month - 1) % MONTHS[period]) + MONTHS[period] - 1
	return `${String(year).padStart(4, "0")}-${String(last).padStart(2, "0")}-${monthDays(year, last)}`
}

/** The period's counted length, walked one day at a time so Feb 29 is skipped, not subtracted. */
function periodCountedDays(end: DateString, period: CompoundingPeriod): number {
	let days = 0
	for (let day = periodStart(end, period); day <= end; day = oracleAddDays(day, 1)) {
		const [, month, date] = parse(day)
		if (month !== 2 || date !== 29) days++
	}
	return days
}

function denominator(end: DateString, rule: OracleNominalRule): bigint {
	return (
		10000n *
		BigInt(12 / MONTHS[rule.compounding]) *
		BigInt(periodCountedDays(end, rule.compounding))
	)
}

function roundHalfUp(numerator: bigint, divisor: bigint): bigint {
	return (numerator * 2n + divisor) / (divisor * 2n)
}

/** Accrues day by day, capitalising each period end; `date` itself is included. */
export function oracleWalk(
	accrual: OracleAccrual,
	rule: OracleNominalRule,
	date: DateString,
): OracleAccrual {
	let capitalised = accrual.capitalised
	let numerator = accrual.numerator
	let asOf = accrual.asOf
	while (asOf < date) {
		asOf = oracleAddDays(asOf, 1)
		const [, month, day] = parse(asOf)
		if (month !== 2 || day !== 29) numerator += capitalised
		if (asOf === compoundingDate(asOf, rule.compounding)) {
			capitalised += roundHalfUp(numerator * BigInt(rule.rate), denominator(asOf, rule))
			numerator = 0n
		}
	}
	return { capitalised, numerator, asOf }
}

/** The value at `date`: completed periods capitalised, the running period's interest rounded. */
export function oracleNominalParts(
	accrual: OracleAccrual,
	rule: OracleNominalRule,
	date: DateString,
): OracleValueParts {
	const walked = oracleWalk(accrual, rule, date)
	const end = compoundingDate(oracleAddDays(walked.asOf, 1), rule.compounding)
	const accruedInterest =
		walked.numerator === 0n
			? 0n
			: roundHalfUp(walked.numerator * BigInt(rule.rate), denominator(end, rule))
	return {
		capitalised: walked.capitalised,
		accruedInterest,
		amount: walked.capitalised + accruedInterest,
	}
}
