import { FI_METHODS } from "../vocab"
import type { Check, Emit, Path, Problem } from "./codes"
import { makeGuard } from "./guard"
import { amount, growth, oneOf } from "./scalars"
import { checkShape, opt, req } from "./shape"

const retirementSpending: Check = (value, path, emit) => {
	checkShape(value, path, { amount: req(amount), growth: req(growth) }, emit)
}

const shape = {
	method: req(oneOf(FI_METHODS, "INVALID_FI_METHOD")),
	retirementSpending: opt(retirementSpending),
	minBufferMonths: opt(amount),
}

function checkOptions(value: unknown, path: Path, emit: Emit): void {
	checkShape(value, path, shape, emit)
}

/** Validates `FinancialIndependenceOptions` separately from the three projection inputs. */
export function checkFinancialIndependenceOptions(value: unknown): readonly Problem[] {
	const problems: Problem[] = []
	const emit: Emit = (code, path) => void problems.push({ code, path })
	const guard = makeGuard(emit)
	guard("options", undefined, () => checkOptions(value, ["options"], emit))
	return problems
}
