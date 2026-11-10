import { ACCOUNT_KINDS, COMPOUNDING_PERIODS } from "../vocab"
import type { AccountIndex, Check, Emit, Path } from "./codes"
import { date, oneOf, safeInt, str } from "./scalars"
import { checkShape, checkUnique, isRecord, list, opt, req } from "./shape"

/** A valid compounding period, so the nominal-rate rule knows whether to apply. */
function isCompoundingPeriod(value: unknown): boolean {
	return typeof value === "string" && COMPOUNDING_PERIODS.some((period) => period === value)
}

const shape = {
	id: req(str),
	kind: req(oneOf(ACCOUNT_KINDS, "INVALID_KIND")),
	rate: req(safeInt),
	compounding: opt(oneOf(COMPOUNDING_PERIODS, "INVALID_COMPOUNDING")),
	lockedUntil: opt(date),
}

/**
 * One rate problem at most: a nominal Account's rate is non-negative, an effective annual one
 * keeps the `-9999` floor. An absent or invalid `compounding` never applies the nominal floor.
 */
function checkRate(value: unknown, path: Path, emit: Emit): void {
	const record = isRecord(value) ? value : {}
	const rate = record["rate"]
	if (typeof rate !== "number" || !Number.isSafeInteger(rate)) return
	const floor = isCompoundingPeriod(record["compounding"]) ? 0 : -9999
	if (rate < floor) emit("RATE_OUT_OF_RANGE", [...path, "rate"])
}

const account: Check = (value, path, emit) => {
	const checked = checkShape(value, path, shape, emit)
	if (checked?.["kind"] === "liability" && Object.hasOwn(checked, "lockedUntil")) {
		emit("LIABILITY_MISUSE", [...path, "lockedUntil"])
	}
	checkRate(value, path, emit)
}

export function checkAccounts(value: unknown, path: Path, emit: Emit): void {
	list(account)(value, path, emit)
	checkUnique(value, path, "id", emit)
}

/**
 * Declared account ids (first declaration wins) mapped to their raw `kind`. `undefined` when
 * `accounts` is not an array, so reference checks are skipped rather than flooding the output.
 */
export function indexAccounts(accounts: unknown): AccountIndex | undefined {
	if (!Array.isArray(accounts)) return undefined
	const index = new Map<string, unknown>()
	for (let i = 0; i < accounts.length; i++) {
		const item: unknown = accounts[i]
		if (isRecord(item) && typeof item["id"] === "string" && !index.has(item["id"])) {
			index.set(item["id"], item["kind"])
		}
	}
	return index
}
