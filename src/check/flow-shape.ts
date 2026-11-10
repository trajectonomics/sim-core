import { FLOW_KINDS, FREQUENCIES } from "../vocab"
import type { AccountIndex } from "./codes"
import { derive } from "./derive"
import { cappedPrepayment, label, NOT_ALLOWED } from "./flow-fields"
import { prepayments } from "./prepayments"
import { accountRef } from "./refs"
import { amount, bool, date, growth, oneOf, str } from "./scalars"
import { opt, req, type Shape } from "./shape"

/** What a Flow's fields may reference: the Accounts, and the Levies a label or share needs. */
export interface FlowContext {
	readonly accounts: AccountIndex | undefined
	readonly hasLevy: boolean
	readonly levyIds: ReadonlySet<string>
}

const base: Shape = {
	id: req(str),
	kind: req(oneOf(FLOW_KINDS, "INVALID_KIND")),
	amount: opt(amount),
	frequency: req(oneOf(FREQUENCIES, "INVALID_FREQUENCY")),
	start: req(date),
	end: opt(date),
	growth: opt(growth),
	derive: opt(derive),
}

/**
 * Keys allowed per flow kind; an invalid kind accepts every optional kind-specific key.
 * `label`, `prepayments` and `cappedPrepayment` need a Levy in the Scenario (`hasLevy`).
 */
export function flowShape(kind: unknown, context: FlowContext): Shape {
	const target = accountRef(context.accounts)
	const levied = {
		label: label(context.hasLevy),
		prepayments: prepayments(context.hasLevy, context.levyIds),
	}
	const capped = cappedPrepayment(context.hasLevy)
	if (kind === "income") return { ...base, earned: req(bool), ...levied, cappedPrepayment: capped }
	if (kind === "contribution") {
		return {
			...base,
			target: req(target),
			label: label(context.hasLevy),
			prepayments: NOT_ALLOWED,
			cappedPrepayment: NOT_ALLOWED,
		}
	}
	if (kind === "expense") {
		return {
			...base,
			label: NOT_ALLOWED,
			prepayments: NOT_ALLOWED,
			cappedPrepayment: NOT_ALLOWED,
		}
	}
	return { ...base, earned: opt(bool), target: opt(target), ...levied, cappedPrepayment: capped }
}
