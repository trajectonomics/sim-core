import type { Emit } from "./codes"
import { isValidDate } from "./date"
import { readTallies, tallyKey } from "./levy-tally-read"
import { isRecord } from "./shape"

/** Adds the pair a label supplies under `basis`, when the pair is one the engine would tally. */
function addLabel(pairs: Set<string>, basis: unknown, label: unknown): void {
	const pair = tallyKey(basis, label)
	if (pair !== undefined) pairs.add(pair)
}

/** Pairs the Scenario's Flows supply: an income `label` is gross, a contribution `label` funded. */
function flowPairs(flows: readonly unknown[], pairs: Set<string>): void {
	for (let index = 0; index < flows.length; index++) {
		const flow: unknown = flows[index]
		if (!isRecord(flow)) continue
		if (flow["kind"] === "income") addLabel(pairs, "gross", flow["label"])
		if (flow["kind"] === "contribution") addLabel(pairs, "funded", flow["label"])
	}
}

/** Pairs the Scenario's Accounts supply: an asset's `returnLabel` is returns, `gainLabel` gains. */
function accountPairs(accounts: readonly unknown[], pairs: Set<string>): void {
	for (let index = 0; index < accounts.length; index++) {
		const account: unknown = accounts[index]
		if (!isRecord(account) || account["kind"] !== "asset") continue
		addLabel(pairs, "returns", account["returnLabel"])
		addLabel(pairs, "gains", account["gainLabel"])
	}
}

/** Pairs every Levy tallies, or `undefined` when the Scenario's Flows or Accounts are unreadable. */
function sharedPairs(scenario: Readonly<Record<string, unknown>>): Set<string> | undefined {
	const flows = scenario["flows"]
	const accounts = scenario["accounts"]
	if (!Array.isArray(flows) || !Array.isArray(accounts)) return undefined
	const pairs = new Set<string>()
	flowPairs(flows, pairs)
	accountPairs(accounts, pairs)
	return pairs
}

/** Pairs one Carry-in record's tallies supply. */
function tallyPairs(tallies: unknown, pairs: Set<string>): void {
	if (!Array.isArray(tallies)) return
	for (let index = 0; index < tallies.length; index++) {
		const entry: unknown = tallies[index]
		if (isRecord(entry)) addLabel(pairs, entry["basis"], entry["label"])
	}
}

/** Pairs this Levy's Carry-in supplies; a record the engine ignores for `start` supplies none. */
function carryInPairs(levy: Readonly<Record<string, unknown>>, start: string): Set<string> {
	const pairs = new Set<string>()
	const records = levy["carryIn"]
	if (!Array.isArray(records)) return pairs
	for (let index = 0; index < records.length; index++) {
		const item: unknown = records[index]
		if (!isRecord(item)) continue
		const periodStart = item["periodStart"]
		if (!isValidDate(periodStart) || periodStart >= start) continue
		tallyPairs(item["tallies"], pairs)
	}
	return pairs
}

/** Whether the Levy reads tallies and the Scenario supplies none of them. */
function unsupplied(levy: unknown, shared: ReadonlySet<string>, start: string): boolean {
	if (!isRecord(levy)) return false
	const read = readTallies(levy)
	if (read.size === 0) return false
	const own = carryInPairs(levy, start)
	for (const pair of read) if (shared.has(pair) || own.has(pair)) return false
	return true
}

function reportUnsupplied(scenario: unknown, timeline: unknown, emit: Emit): void {
	if (!isRecord(scenario) || !isRecord(timeline)) return
	const levies = scenario["levies"]
	const start = timeline["start"]
	if (!Array.isArray(levies) || !isValidDate(start)) return
	const shared = sharedPairs(scenario)
	if (shared === undefined) return
	for (let index = 0; index < levies.length; index++) {
		if (unsupplied(levies[index], shared, start)) {
			emit("UNSUPPLIED_TALLY_LABEL", ["scenario", "levies", index])
		}
	}
}

/** Refuses a Levy whose `due` graph reads tally labels and is supplied none of them. */
export function checkTallySupply(scenario: unknown, timeline: unknown, emit: Emit): void {
	try {
		reportUnsupplied(scenario, timeline, emit)
	} catch {
		// A throwing getter or revoked Proxy is reported at its own root by the main guards.
	}
}
