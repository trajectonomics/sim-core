import type { Emit } from "./codes"
import { checkUniqueValues, isRecord } from "./shape"

const TWO_32 = 4294967296n
const MAX_ACCOUNTS = 64
const MAX_BUCKETS = 512

function validWeight(value: unknown): number | undefined {
	return typeof value === "number" &&
		Number.isSafeInteger(value) &&
		value >= 0 &&
		value <= Number(TWO_32)
		? value
		: undefined
}

export function inspectAccounts(
	value: Readonly<Record<string, unknown>>,
	declared: ReadonlySet<string>,
	emit: Emit,
): void {
	const accounts = value["accounts"]
	if (!Array.isArray(accounts)) return
	checkUniqueValues(accounts, ["model", "accounts"], emit)
	for (let index = 0; index < accounts.length; index++) {
		const account: unknown = accounts[index]
		if (typeof account === "string" && account !== "" && !declared.has(account)) {
			emit("UNKNOWN_ACCOUNT", ["model", "accounts", index])
		}
	}
	if (accounts.length > MAX_ACCOUNTS) emit("TOO_MANY_ENTRIES", ["model", "accounts"])
}

function bucketLengths(buckets: readonly unknown[], count: number, emit: Emit): void {
	for (let index = 0; index < buckets.length; index++) {
		const entry: unknown = buckets[index]
		if (!isRecord(entry)) continue
		const returns = entry["returnsBps"]
		if (Array.isArray(returns) && returns.length !== count) {
			emit("WRONG_TYPE", ["model", "buckets", index, "returnsBps"])
		}
	}
}

/** Every weight, or `[]` as soon as one is not a non-negative safe integer within 2^32. */
function weightsOf(buckets: readonly unknown[]): readonly number[] {
	const weights: number[] = []
	for (const entry of buckets) {
		if (!isRecord(entry)) return []
		const found = validWeight(entry["weight"])
		if (found === undefined) return []
		weights.push(found)
	}
	return weights
}

export function inspectBuckets(value: Readonly<Record<string, unknown>>, emit: Emit): void {
	const buckets = value["buckets"]
	if (!Array.isArray(buckets)) return
	if (buckets.length > MAX_BUCKETS) emit("TOO_MANY_ENTRIES", ["model", "buckets"])
	const count = Array.isArray(value["accounts"]) ? value["accounts"].length : undefined
	if (count !== undefined) bucketLengths(buckets, count, emit)
	const weights = weightsOf(buckets)
	if (weights.length !== buckets.length) return
	const total = weights.reduce((sum, item) => sum + BigInt(item), 0n)
	if (total !== TWO_32) emit("RETURN_WEIGHT_TOTAL", ["model", "buckets"])
}
