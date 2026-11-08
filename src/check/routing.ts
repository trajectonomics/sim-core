import type { AccountIndex, Emit, Path } from "./codes"
import { isRecord } from "./shape"

/** Account ids in `cashflow.contribute`, or `undefined` when the list is unusable. */
function routedContributeIds(
	cashflow: Readonly<Record<string, unknown>>,
): ReadonlySet<string> | undefined {
	const contribute = cashflow["contribute"]
	if (!Array.isArray(contribute)) return undefined
	const routed = new Set<string>()
	for (const item of contribute) if (typeof item === "string") routed.add(item)
	return routed
}

function isUnroutedAsset(
	flow: unknown,
	routed: ReadonlySet<string>,
	accounts: AccountIndex | undefined,
): flow is Readonly<Record<string, unknown>> {
	if (!isRecord(flow) || flow["kind"] !== "contribution") return false
	const target = flow["target"]
	return typeof target === "string" && accounts?.get(target) === "asset" && !routed.has(target)
}

/** Emits `CONTRIBUTION_UNROUTED` for every asset-target contribution absent from `contribute`. */
export function checkContributionRouting(
	flows: unknown,
	cashflow: unknown,
	accounts: AccountIndex | undefined,
	path: Path,
	emit: Emit,
): void {
	if (!Array.isArray(flows) || !isRecord(cashflow)) return
	const routed = routedContributeIds(cashflow)
	if (routed === undefined) return
	for (let index = 0; index < flows.length; index++) {
		if (isUnroutedAsset(flows[index], routed, accounts)) {
			emit("CONTRIBUTION_UNROUTED", [...path, "flows", index, "target"])
		}
	}
}
