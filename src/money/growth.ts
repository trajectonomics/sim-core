import type { BasisPoints } from "../types"
import { DAYS_PER_YEAR, dailyFactor, RATE_SCALE } from "./factor"
import { roundHalfUp } from "./round"

const factorPowers: Map<BasisPoints, bigint[]> = new Map()
const ratePowers: Map<BasisPoints, bigint[]> = new Map()

function powerAt(rate: BasisPoints, exponent: number, rateBase: boolean): bigint {
	const cache = rateBase ? ratePowers : factorPowers
	let powers = cache.get(rate)
	if (powers === undefined) {
		powers = [1n]
		cache.set(rate, powers)
	}
	const base = rateBase ? RATE_SCALE + BigInt(rate) : dailyFactor(rate)
	while (powers.length <= exponent) powers.push(powers[powers.length - 1]! * base)
	return powers[exponent]!
}

interface FactorParts {
	readonly numerator: bigint
	readonly denominator: bigint
}

function splitDays(days: number): readonly [years: number, remainder: number] {
	if (!Number.isSafeInteger(days) || days < 0) {
		throw new RangeError("Growth expects a non-negative safe integer day count")
	}
	const years = Math.floor(days / DAYS_PER_YEAR)
	return [years, days - years * DAYS_PER_YEAR]
}

const partCache: Map<string, FactorParts> = new Map()
const PART_CACHE_LIMIT = 8192

/** `(10000 + rate)^years * f^remainder / (10000^years * 10^(30*remainder))`, cached by both inputs. */
function factorParts(rate: BasisPoints, days: number): FactorParts {
	const key = `${rate}:${days}`
	const cached = partCache.get(key)
	if (cached !== undefined) return cached
	const [years, remainder] = splitDays(days)
	const parts = {
		numerator: powerAt(rate, years, true) * powerAt(rate, remainder, false),
		denominator: powerAt(0, years, true) * powerAt(0, remainder, false),
	}
	if (partCache.size >= PART_CACHE_LIMIT) partCache.clear()
	partCache.set(key, parts)
	return parts
}

/** Grows `amount` over `days` counted days with one half-up rounding at the end. */
export function grow(amount: bigint, rate: BasisPoints, days: number): bigint {
	if (amount === 0n) return 0n
	if (amount > 0n && (days === 0 || rate === 0)) return amount
	const parts = factorParts(rate, days)
	return roundHalfUp(amount * parts.numerator, parts.denominator)
}

/** Today's-money value of `amount` at `inflation`, over `days` counted days. */
export function deflate(amount: bigint, inflation: BasisPoints, days: number): bigint {
	if (amount === 0n) return 0n
	if (amount > 0n && (days === 0 || inflation === 0)) return amount
	const parts = factorParts(inflation, days)
	return roundHalfUp(amount * parts.denominator, parts.numerator)
}
