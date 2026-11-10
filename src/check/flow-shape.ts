import { FLOW_KINDS, FREQUENCIES } from "../vocab"
import type { AccountIndex } from "./codes"
import { cappedPrepayment, label, NOT_ALLOWED, prepaymentBps } from "./flow-fields"
import { accountRef } from "./refs"
import { amount, bool, date, growth, oneOf, str } from "./scalars"
import { opt, req, type Shape } from "./shape"

const base: Shape = {
	id: req(str),
	kind: req(oneOf(FLOW_KINDS, "INVALID_KIND")),
	amount: req(amount),
	frequency: req(oneOf(FREQUENCIES, "INVALID_FREQUENCY")),
	start: req(date),
	end: opt(date),
	growth: req(growth),
}

/**
 * Keys allowed per flow kind; an invalid kind accepts every optional kind-specific key.
 * `label`, `prepaymentBps` and `cappedPrepayment` need a Levy in the Scenario (`hasLevy`).
 */
export function flowShape(
	kind: unknown,
	accounts: AccountIndex | undefined,
	hasLevy: boolean,
): Shape {
	const target = accountRef(accounts)
	const levied = { label: label(hasLevy), prepaymentBps: prepaymentBps(hasLevy) }
	const capped = cappedPrepayment(hasLevy)
	if (kind === "income") return { ...base, earned: req(bool), ...levied, cappedPrepayment: capped }
	if (kind === "contribution") {
		return {
			...base,
			target: req(target),
			...levied,
			prepaymentBps: NOT_ALLOWED,
			cappedPrepayment: NOT_ALLOWED,
		}
	}
	if (kind === "expense") {
		return {
			...base,
			label: NOT_ALLOWED,
			prepaymentBps: NOT_ALLOWED,
			cappedPrepayment: NOT_ALLOWED,
		}
	}
	return { ...base, earned: opt(bool), target: opt(target), ...levied, cappedPrepayment: capped }
}
