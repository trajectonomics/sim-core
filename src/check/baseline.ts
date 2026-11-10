import type { AccountIndex, Check, Emit, Path } from "./codes"
import { balanceRef } from "./refs"
import { amount } from "./scalars"
import { anyVersion, checkShape, checkUnique, list, opt, req } from "./shape"

export function checkBaseline(
	value: unknown,
	path: Path,
	accounts: AccountIndex | undefined,
	emit: Emit,
): void {
	const balance: Check = (item, at, e) =>
		void checkShape(
			item,
			at,
			{ account: req(balanceRef(accounts)), amount: req(amount), basis: opt(amount) },
			e,
		)
	const shape = { schemaVersion: req(anyVersion), balances: req(list(balance)) }
	const baseline = checkShape(value, path, shape, emit)
	checkUnique(baseline?.["balances"], [...path, "balances"], "account", emit)
}
