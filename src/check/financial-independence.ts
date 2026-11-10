import { FI_METHODS } from "../vocab"
import type { Check, Emit, Path, Problem } from "./codes"
import { makeGuard } from "./guard"
import { amount, boundedInt, growth, oneOf } from "./scalars"
import { checkShape, isRecord, opt, req } from "./shape"

const retirementSpending: Check = (value, path, emit) => {
	checkShape(value, path, { amount: req(amount), growth: req(growth) }, emit)
}

const SEED = /^[0-9a-f]{16}$/

/** Exactly 16 lower-case hex digits, as ADR-0005 fixes the Seed. */
const seed: Check = (value, path, emit) => {
	if (typeof value !== "string" || !SEED.test(value)) emit("INVALID_SEED", path)
}

const thresholdBps = boundedInt(1, 10000, "RATE_OUT_OF_RANGE")
const paths = boundedInt(1, 200, "INVALID_PATH_COUNT")

const shared = { retirementSpending: opt(retirementSpending), minBufferMonths: opt(amount) }

const survivalShape = { method: req(oneOf(FI_METHODS, "INVALID_FI_METHOD")), ...shared }

const probabilityShape = {
	method: req(oneOf(FI_METHODS, "INVALID_FI_METHOD")),
	thresholdBps: req(thresholdBps),
	paths: req(paths),
	seed: req(seed),
	...shared,
}

/** A missing or unknown method reports itself once, without flagging the fields of either case. */
const unknownMethodShape = {
	method: req(oneOf(FI_METHODS, "INVALID_FI_METHOD")),
	thresholdBps: opt(thresholdBps),
	paths: opt(paths),
	seed: opt(seed),
	...shared,
}

function checkOptions(value: unknown, path: Path, emit: Emit): void {
	if (!isRecord(value)) {
		emit("NOT_AN_OBJECT", path)
		return
	}
	const method = value["method"]
	const shape =
		method === "probabilityThreshold"
			? probabilityShape
			: method === "survival"
				? survivalShape
				: unknownMethodShape
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
