import { checkAccounts } from "./accounts"
import { checkCashflow } from "./cashflow"
import type { AccountIndex, Check, Emit, Path } from "./codes"
import { checkFlows } from "./flows"
import { checkLevy } from "./levy"
import { rate, str } from "./scalars"
import { anyVersion, checkShape, isRecord, opt, req } from "./shape"

const economy: Check = (value, path, emit) => {
	checkShape(value, path, { inflation: req(rate) }, emit)
}

export function checkScenario(
	value: unknown,
	path: Path,
	accounts: AccountIndex | undefined,
	emit: Emit,
): void {
	const hasLevy = isRecord(value) && Object.hasOwn(value, "levy")
	const shape = {
		schemaVersion: req(anyVersion),
		currency: req(str),
		economy: req(economy),
		accounts: req(checkAccounts),
		flows: req((v, p, e) => checkFlows(v, p, accounts, e, hasLevy)),
		cashflow: req((v, p, e) => checkCashflow(v, p, accounts, e)),
		levy: opt(checkLevy),
	}
	checkShape(value, path, shape, emit)
}
