import { isSafeInteger, overflow } from "../engine/overflow"
import type { StateMap } from "../engine/state"
import { valuation } from "../engine/value"
import type { DateString } from "../types"
import type { TwentyFiveTimesReference } from "../types/financial-independence"
import type { ProjectionProblem } from "../types/projection"

export type ReferenceOutcome =
	| { readonly ok: true; readonly reference: TwentyFiveTimesReference }
	| { readonly ok: false; readonly problem: ProjectionProblem }

function unlockedAssets(states: StateMap, date: DateString): bigint | ProjectionProblem {
	let total = 0n
	for (const state of states.values()) {
		if (state.rule.kind !== "asset") continue
		if (state.rule.lockedUntil !== undefined && date < state.rule.lockedUntil) continue
		const value = valuation(state, date)
		if (!isSafeInteger(value)) return overflow(date, state.rule.id)
		total += value
	}
	return isSafeInteger(total) ? total : overflow(date)
}

/** The informational 25× rule-of-thumb beside a reachable month; it never decides the answer. */
export function twentyFiveTimes(
	states: StateMap,
	date: DateString,
	annualExpenses: bigint,
): ReferenceOutcome {
	const assets = unlockedAssets(states, date)
	if (typeof assets !== "bigint") return { ok: false, problem: assets }
	if (!isSafeInteger(annualExpenses)) return { ok: false, problem: overflow(date) }
	const threshold = 25n * annualExpenses
	if (!isSafeInteger(threshold)) return { ok: false, problem: overflow(date) }
	const multiple = annualExpenses > 0n ? (assets * 10000n) / annualExpenses : undefined
	if (multiple !== undefined && !isSafeInteger(multiple)) {
		return { ok: false, problem: overflow(date) }
	}
	return {
		ok: true,
		reference: {
			label: "ruleOfThumb25x",
			date,
			unlockedAssets: Number(assets),
			annualExpenses: Number(annualExpenses),
			threshold: Number(threshold),
			...(multiple === undefined ? {} : { multipleBps: Number(multiple) }),
			met: assets >= threshold,
		},
	}
}
