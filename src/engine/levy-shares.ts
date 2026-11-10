import { roundHalfUp } from "../money/round"
import type { Prepayment } from "../types"
import type { LevyTally } from "./levy-types"

/** One Levy's period state at an Occurrence date, for the shares a Flow credits it. */
export interface LevyPeriodView {
	readonly levy: string
	readonly tally: LevyTally | undefined
	readonly caps: ReadonlyMap<string, bigint> | undefined
}

/** A rate in basis points of `amount`, rounded half up in minor units. */
export function share(amount: bigint, bps: number): bigint {
	return roundHalfUp(amount * BigInt(bps), 10_000n)
}

/** Period-to-date gross of `label` before this event: the tracker's total plus today's earlier ones. */
export function settlementPeriodGross(
	view: LevyPeriodView,
	label: string,
	today: ReadonlyMap<string, bigint>,
): bigint {
	return (view.tally?.gross.get(label) ?? 0n) + (today.get(label) ?? 0n)
}

/** The part of `amount` that lies below `cap` on a period-to-date gross of `already`. */
export function eligible(amount: bigint, already: bigint, cap: bigint): bigint {
	const room = cap - already
	if (room <= 0n) return 0n
	return room < amount ? room : amount
}

function entryFor(entries: readonly Prepayment[], levy: string): Prepayment | undefined {
	for (let index = 0; index < entries.length; index++) {
		const entry = entries[index]
		if (entry !== undefined && entry.levy === levy) return entry
	}
	return undefined
}

/**
 * The plain shares in Scenario Levy order, rounded cumulatively: Levy i gets
 * `round(amount·S_i/10000) − round(amount·S_(i−1)/10000)`, so they never exceed the gross.
 */
export function plainShares(
	entries: readonly Prepayment[],
	amount: bigint,
	views: readonly LevyPeriodView[],
): ReadonlyMap<string, bigint> {
	const shares = new Map<string, bigint>()
	let running = 0n
	let credited = 0n
	for (const view of views) {
		const entry = entryFor(entries, view.levy)
		if (entry === undefined) continue
		running += BigInt(entry.bps)
		const upto = share(amount, Number(running))
		shares.set(view.levy, upto - credited)
		credited = upto
	}
	return shares
}
