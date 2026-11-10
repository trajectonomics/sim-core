import { countedDays } from "../calendar/counted"
import { isSafeInteger, overflow } from "../engine/overflow"
import type { EngineSnapshot } from "../engine/snapshot"
import { deflate } from "../money/growth"
import type { BasisPoints, DateString } from "../types"
import type { ProjectionBalance, ProjectionProblem } from "../types/projection"
import type { RuleMap } from "./rules"

export interface RealValues {
	readonly balances: readonly ProjectionBalance[]
	readonly netWorth: bigint
	readonly accessibleNetWorth: bigint
}

export interface RealOutcome {
	readonly values: RealValues | undefined
	readonly problem: ProjectionProblem | undefined
}

/** One row balance deflated component by component; `amount` is the sum of the two. */
function deflated(
	balance: EngineSnapshot["balances"][number],
	inflation: BasisPoints,
	days: number,
): ProjectionBalance | undefined {
	const capitalised = deflate(balance.capitalised, inflation, days)
	const accruedInterest = deflate(balance.accruedInterest, inflation, days)
	const amount = capitalised + accruedInterest
	if (!isSafeInteger(amount) || !isSafeInteger(capitalised)) return undefined
	return {
		account: balance.account,
		amount: Number(amount),
		capitalised: Number(capitalised),
		accruedInterest: Number(accruedInterest),
	}
}

/** Deflates each account's components separately, then sums the signed real amounts. */
export function realValues(
	snapshot: EngineSnapshot,
	rules: RuleMap,
	start: DateString,
	inflation: BasisPoints,
): RealOutcome {
	const days = countedDays(start, snapshot.date)
	const balances: ProjectionBalance[] = []
	let net = 0n
	let accessible = 0n
	for (const balance of snapshot.balances) {
		const real = deflated(balance, inflation, days)
		if (real === undefined)
			return { values: undefined, problem: overflow(snapshot.date, balance.account) }
		balances.push(real)
		const amount = BigInt(real.amount)
		const rule = rules.get(balance.account)
		const signed = rule?.kind === "liability" ? -amount : amount
		net += signed
		const unlocked =
			rule?.kind !== "asset" || rule.lockedUntil === undefined || snapshot.date >= rule.lockedUntil
		if (unlocked) accessible += signed
	}
	if (!isSafeInteger(net) || !isSafeInteger(accessible)) {
		return { values: undefined, problem: overflow(snapshot.date) }
	}
	return { values: { balances, netWorth: net, accessibleNetWorth: accessible }, problem: undefined }
}
