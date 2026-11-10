import { oracleDivide } from "./oracle-measure"
import type { OracleIncome } from "./oracle-prepayment"

// BigInt has no Math.min.
function lesser(left: bigint, right: bigint): bigint {
	if (left < right) return left
	return right
}

/** The plain shares in Levy order, each the difference of two cumulative half-up roundings. */
export function oraclePlainShares(
	item: OracleIncome,
	levyOrder: readonly string[],
): ReadonlyMap<string, bigint> {
	const shares = new Map<string, bigint>()
	let running = 0n
	let credited = 0n
	for (const levy of levyOrder) {
		const entry = item.shares.find((share) => share.levy === levy)
		if (entry === undefined) continue
		running += BigInt(entry.bps)
		const upto = oracleDivide(item.amount * running, 10_000n, "halfUp")
		shares.set(levy, upto - credited)
		credited = upto
	}
	return shares
}

/** The capped share on the part of an Occurrence below the cap on its label's period-to-date gross. */
function cappedShare(item: OracleIncome, already: bigint): bigint {
	if (item.cap === undefined || item.capBps === undefined) return 0n
	const room = item.cap - already
	if (room <= 0n) return 0n
	return oracleDivide(lesser(room, item.amount) * BigInt(item.capBps), 10_000n, "halfUp")
}

/**
 * The period's Prepayment per Levy: each plain share rounded cumulatively, plus the capped one
 * only on the part of an Occurrence below the cap on its label's period-to-date gross, seeded
 * from `startingGross` (Carry-in included).
 */
export function oraclePrepaidByLevy(
	incomes: readonly OracleIncome[],
	levyOrder: readonly string[],
	startingGross: ReadonlyMap<string, bigint> = new Map(),
): ReadonlyMap<string, bigint> {
	const gross = new Map(startingGross)
	const prepaid = new Map<string, bigint>()
	for (const item of incomes) {
		for (const [levy, share] of oraclePlainShares(item, levyOrder)) {
			prepaid.set(levy, (prepaid.get(levy) ?? 0n) + share)
		}
		if (item.capLevy !== undefined) {
			const share = cappedShare(item, gross.get(item.label) ?? 0n)
			prepaid.set(item.capLevy, (prepaid.get(item.capLevy) ?? 0n) + share)
		}
		gross.set(item.label, (gross.get(item.label) ?? 0n) + item.amount)
	}
	return prepaid
}

/** The period's total Prepayment in minor units, summed over every Levy. */
export function oraclePrepaid(
	incomes: readonly OracleIncome[],
	levyOrder: readonly string[],
	startingGross: ReadonlyMap<string, bigint> = new Map(),
): bigint {
	let total = 0n
	for (const share of oraclePrepaidByLevy(incomes, levyOrder, startingGross).values())
		total += share
	return total
}
