import type { MeasureOp } from "../types"
import { MEASURE_OPS, ROUNDINGS, TALLY_BASES } from "../vocab"
import type { Check, Emit, Path } from "./codes"
import { checkSteps, steps } from "./const-steps"
import { boundedInt, date, growth, oneOf, safeInt, str } from "./scalars"
import { checkShape, isRecord, opt, req, type Shape } from "./shape"

const denominator: Check = boundedInt(1, Infinity, "INVALID_DENOMINATOR")

const operands = { a: req(str), b: req(str) }

/** Keys beyond `id` and `op` that each op takes. */
const OP_SHAPES: Readonly<Record<MeasureOp, Shape>> = {
	const: { value: req(safeInt), asOf: opt(date), growth: opt(growth), steps },
	tally: { label: req(str), basis: req(oneOf(TALLY_BASES, "INVALID_BASIS")) },
	add: operands,
	sub: operands,
	min: operands,
	max: operands,
	scale: {
		of: req(str),
		num: req(safeInt),
		den: req(denominator),
		rounding: req(oneOf(ROUNDINGS, "INVALID_ROUNDING")),
	},
	mul: {
		...operands,
		den: req(denominator),
		rounding: req(oneOf(ROUNDINGS, "INVALID_ROUNDING")),
	},
	pick: {
		...operands,
		// biome-ignore lint/suspicious/noThenProperty: `then` is a Measure operand key, not a thenable
		then: req(str),
		else: req(str),
	},
	flow: { flow: req(str) },
}

const ignore: Check = () => {}

/** Every op's keys, all allowed but unchecked: an unknown op reports only `INVALID_OP`, not problems in its other keys. */
const ANY_OP: Shape = Object.fromEntries(
	Object.values(OP_SHAPES).flatMap((shape) =>
		Object.keys(shape).map((key) => [key, opt(ignore)] as const),
	),
)

const common: Shape = { id: req(str), op: req(oneOf(MEASURE_OPS, "INVALID_OP")) }

const isOp = (op: unknown): op is MeasureOp =>
	typeof op === "string" && (MEASURE_OPS as readonly string[]).includes(op)

/** What a Measure list may name: a Levy takes `tally` and not `flow`, a Derived amount the reverse. */
export interface MeasureRules {
	readonly deny: readonly MeasureOp[]
	/** Keys a `const` may not carry here. */
	readonly constDenied: readonly string[]
}

export const LEVY_RULES: MeasureRules = { deny: ["flow"], constDenied: [] }
export const DERIVE_RULES: MeasureRules = {
	deny: ["tally"],
	constDenied: ["asOf", "growth", "steps"],
}

/** Reports `FIELD_NOT_ALLOWED` for each of `keys` a Measure carries. */
function forbid(
	measure: Readonly<Record<string, unknown>>,
	keys: readonly string[],
	at: Path,
	emit: Emit,
): void {
	for (const key of keys) {
		if (Object.hasOwn(measure, key)) emit("FIELD_NOT_ALLOWED", [...at, key])
	}
}

function checkConst(
	found: Readonly<Record<string, unknown>>,
	rules: MeasureRules,
	path: Path,
	emit: Emit,
): void {
	if (Object.hasOwn(found, "growth") && !Object.hasOwn(found, "asOf")) {
		emit("MISSING_KEY", [...path, "asOf"])
	}
	forbid(found, rules.constDenied, path, emit)
	if (Object.hasOwn(found, "steps")) checkSteps(found, path, emit)
}

/** A Measure check for one context: an op it does not allow reports `INVALID_OP` and nothing else. */
export function measure(rules: MeasureRules): Check {
	return (value, path, emit) => {
		const op = isRecord(value) ? value["op"] : undefined
		if (isOp(op) && rules.deny.includes(op)) return emit("INVALID_OP", [...path, "op"])
		const own = isOp(op) ? OP_SHAPES[op] : ANY_OP
		const found = checkShape(value, path, { ...common, ...own }, emit)
		if (found && op === "const") checkConst(found, rules, path, emit)
	}
}
