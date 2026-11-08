import { isSafeInteger, overflow } from "../engine/overflow"
import type { StateMap } from "../engine/state"
import { valuation } from "../engine/value"
import type { DateString, Scenario } from "../types"
import type { ProjectionProblem } from "../types/projection"

export type AssetValue = { readonly value: bigint } | { readonly problem: ProjectionProblem }

/** Value of assets locked or absent from `withdraw` on a Shortfall date. */
export function lockedOrAbsentAssets(
	states: StateMap,
	scenario: Scenario,
	date: DateString,
): AssetValue {
	const withdraw = new Set(scenario.cashflow.withdraw)
	let total = 0n
	for (const state of states.values()) {
		if (state.rule.kind !== "asset") continue
		const locked = state.rule.lockedUntil !== undefined && date < state.rule.lockedUntil
		if (!locked && withdraw.has(state.rule.id)) continue
		const amount = valuation(state, date)
		if (!isSafeInteger(amount)) return { problem: overflow(date, state.rule.id) }
		total += amount
	}
	return isSafeInteger(total) ? { value: total } : { problem: overflow(date) }
}
