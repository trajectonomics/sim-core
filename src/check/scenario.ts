import { checkAccounts } from "./accounts"
import { checkCalendar } from "./calendar"
import { checkCashflow } from "./cashflow"
import type { AccountIndex, Check, Emit, Path } from "./codes"
import { checkFlowCaps } from "./flow-caps"
import { checkFlows, type FlowContext } from "./flows"
import { checkLevies } from "./levy"
import { checkContributionRouting } from "./routing"
import { rate, str } from "./scalars"
import { anyVersion, checkShape, isRecord, opt, req } from "./shape"

const economy: Check = (value, path, emit) => {
	checkShape(value, path, { inflation: req(rate) }, emit)
}

/** Ids of the Levies the Scenario declares, for every reference a Flow may make. */
function levyIds(value: unknown): ReadonlySet<string> {
	const ids = new Set<string>()
	if (!Array.isArray(value)) return ids
	for (const item of value) {
		if (isRecord(item) && typeof item["id"] === "string") ids.add(item["id"])
	}
	return ids
}

export function checkScenario(
	value: unknown,
	path: Path,
	accounts: AccountIndex | undefined,
	emit: Emit,
): void {
	const levies = isRecord(value) ? value["levies"] : undefined
	const hasLevy = Array.isArray(levies) && levies.length > 0
	const context: FlowContext = { accounts, hasLevy, levyIds: levyIds(levies) }
	const shape = {
		schemaVersion: req(anyVersion),
		currency: req(str),
		economy: req(economy),
		accounts: req((v, p, e) => checkAccounts(v, p, e, hasLevy)),
		flows: req((v, p, e) => checkFlows(v, p, context, e)),
		cashflow: req((v, p, e) => checkCashflow(v, p, accounts, e)),
		levies: opt(checkLevies),
		calendar: opt(checkCalendar),
	}
	const checked = checkShape(value, path, shape, emit)
	checkFlowCaps(checked?.["flows"], checked?.["levies"], path, emit)
	checkContributionRouting(checked?.["flows"], checked?.["cashflow"], accounts, path, emit)
}
