import type { Emit } from "./codes"
import { isRecord } from "./shape"

/** A property of possibly hostile input; a throwing getter is left to the scenario's own check. */
function safeGet(value: unknown, key: string): unknown {
	try {
		return isRecord(value) ? value[key] : undefined
	} catch {
		return undefined
	}
}

/** Declared Accounts whose rule carries a `gainLabel`, first declaration wins. */
function gainTracked(accounts: unknown): ReadonlySet<string> {
	const tracked = new Set<string>()
	if (!Array.isArray(accounts)) return tracked
	for (const rule of accounts) {
		if (!isRecord(rule) || typeof rule["id"] !== "string") continue
		const label = rule["gainLabel"]
		if (rule["kind"] === "asset" && typeof label === "string") tracked.add(rule["id"])
	}
	return tracked
}

/** Whether one balance entry must state an opening basis. */
function needsBasis(
	entry: Readonly<Record<string, unknown>>,
	tracked: ReadonlySet<string>,
): boolean {
	const account = entry["account"]
	const amount = entry["amount"]
	if (typeof account !== "string" || !tracked.has(account)) return false
	if (typeof amount !== "number" || amount <= 0) return false
	return !Object.hasOwn(entry, "basis")
}

/** Requires an opening `basis` for a positive balance on a gain-tracked Account. */
export function checkBaselineBasis(baseline: unknown, scenario: unknown, emit: Emit): void {
	const balances = safeGet(baseline, "balances")
	if (!Array.isArray(balances)) return
	const tracked = gainTracked(safeGet(scenario, "accounts"))
	if (tracked.size === 0) return
	for (let index = 0; index < balances.length; index++) {
		const entry: unknown = balances[index]
		if (isRecord(entry) && needsBasis(entry, tracked)) {
			emit("MISSING_BASIS", ["baseline", "balances", index, "basis"])
		}
	}
}
