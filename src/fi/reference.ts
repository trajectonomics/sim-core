import { addMonthsClamped } from "../calendar/arith"
import { isSafeInteger, overflow } from "../engine/overflow"
import type { StateMap } from "../engine/state"
import type { DateString } from "../types"
import type { ProjectionProblem } from "../types/projection"
import type { RuleOfThumbReference } from "../types/reference"
import { cloneStates } from "./clone"
import { expenseBetween } from "./expense-window"
import { referenceSums } from "./reference-numerator"
import type { ReferencePlan } from "./reference-plan"

export type ReferenceOutcome =
	| { readonly ok: true; readonly reference: RuleOfThumbReference }
	| { readonly ok: false; readonly problem: ProjectionProblem }

const LAST_SUPPORTED_DATE = "9998-12-31"

interface Span {
	readonly from: DateString
	readonly to: DateString
	readonly partial: boolean
}

function span(plan: ReferencePlan, month: DateString): Span {
	if (plan.config.window === "next12Months") {
		const to = addMonthsClamped(month, 12)
		return { from: month, to, partial: to > LAST_SUPPORTED_DATE }
	}
	const start = addMonthsClamped(month, -12)
	const early = start < plan.money.start
	return { from: early ? plan.money.start : start, to: month, partial: early }
}

/** Floor division toward negative infinity; BigInt `/` truncates toward zero. */
function floorDiv(numerator: bigint, denominator: bigint): bigint {
	const quotient = numerator / denominator
	const remainder = numerator % denominator
	return remainder !== 0n && numerator < 0n !== denominator < 0n ? quotient - 1n : quotient
}

/**
 * The informational rule-of-thumb beside a reachable month; it never decides the answer.
 * It reads a copy, because a nominal Account capitalises (and moves its clock) on a read.
 */
export function ruleOfThumb(
	states: StateMap,
	month: DateString,
	plan: ReferencePlan,
): ReferenceOutcome {
	const { config, money } = plan
	const sums = referenceSums(cloneStates(states), month, config.basis, money)
	if (!("unlockedAssets" in sums)) return { ok: false, problem: sums }
	const range = span(plan, month)
	const measured = expenseBetween(plan.window, range.from, range.to)
	if (measured.kind === "problem") return { ok: false, problem: measured.problem }
	const annualExpenses = measured.amount
	const threshold = BigInt(config.multiplier) * annualExpenses
	if (!isSafeInteger(annualExpenses) || !isSafeInteger(threshold)) {
		return { ok: false, problem: overflow(month) }
	}
	const multiple =
		annualExpenses === 0n ? undefined : floorDiv(sums.numerator * 10000n, annualExpenses)
	if (multiple !== undefined && !isSafeInteger(multiple)) {
		return { ok: false, problem: overflow(month) }
	}
	return {
		ok: true,
		reference: {
			label: "ruleOfThumb",
			date: month,
			multiplier: config.multiplier,
			basis: config.basis,
			window: config.window,
			terms: config.terms,
			unlockedAssets: Number(sums.unlockedAssets),
			numerator: Number(sums.numerator),
			annualExpenses: Number(annualExpenses),
			threshold: Number(threshold),
			partial: range.partial,
			...(multiple === undefined ? {} : { multipleBps: Number(multiple) }),
			met: sums.numerator >= threshold,
		},
	}
}
