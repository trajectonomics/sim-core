import type { Measure } from "../types"

type ByOp = { readonly [M in Measure as M["op"]]: M }
type OperandKey<M> = Extract<keyof M, "a" | "b" | "of" | "then" | "else">

/** The keys of a Measure that hold other Measure ids; each op lists only keys its type has. */
export const REF_KEYS: { readonly [Op in keyof ByOp]: readonly OperandKey<ByOp[Op]>[] } =
	Object.freeze({
		const: [],
		tally: [],
		add: ["a", "b"],
		sub: ["a", "b"],
		min: ["a", "b"],
		max: ["a", "b"],
		scale: ["of"],
		pick: ["a", "b", "then", "else"],
	})

const BY_NAME: Readonly<Record<string, readonly string[]>> = REF_KEYS

/** The operand keys for an op name that may not be a known op (unvalidated input). */
export function refKeysOf(op: string): readonly string[] {
	return Object.hasOwn(BY_NAME, op) ? (BY_NAME[op] ?? []) : []
}

/** The ids of the Measures a Measure reads, in `REF_KEYS` order. */
export function operandsOf(measure: Measure): readonly string[] {
	const keys: readonly string[] = REF_KEYS[measure.op]
	return keys.flatMap((key) => {
		const operand: unknown = Reflect.get(measure, key)
		return typeof operand === "string" ? [operand] : []
	})
}
