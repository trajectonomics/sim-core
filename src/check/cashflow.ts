import type { AccountIndex, Check, Emit, Path } from "./codes"
import { spendableRef } from "./refs"
import { amount } from "./scalars"
import { checkShape, checkUnique, checkUniqueValues, isRecord, list, opt, req } from "./shape"

function checkRouting(cashflow: Readonly<Record<string, unknown>>, path: Path, emit: Emit): void {
	const surplus = cashflow["surplus"]
	if (!Array.isArray(surplus)) return
	if (surplus.length === 0) {
		emit("SURPLUS_UNROUTED", [...path, "surplus"])
		return
	}
	const last = surplus[surplus.length - 1]
	if (isRecord(last) && Object.hasOwn(last, "upTo")) {
		emit("SURPLUS_UNROUTED", [...path, "surplus", surplus.length - 1, "upTo"])
	}
}

export function checkCashflow(
	value: unknown,
	path: Path,
	accounts: AccountIndex | undefined,
	emit: Emit,
): void {
	const account = spendableRef(accounts)
	const step: Check = (item, at, e) =>
		void checkShape(item, at, { account: req(account), upTo: opt(amount) }, e)
	const cashflow = checkShape(
		value,
		path,
		{
			surplus: req(list(step)),
			contribute: req(list(account)),
			withdraw: req(list(account)),
		},
		emit,
	)
	if (cashflow) checkRouting(cashflow, path, emit)
	checkUnique(cashflow?.["surplus"], [...path, "surplus"], "account", emit)
	checkUniqueValues(cashflow?.["contribute"], [...path, "contribute"], emit)
	checkUniqueValues(cashflow?.["withdraw"], [...path, "withdraw"], emit)
}
