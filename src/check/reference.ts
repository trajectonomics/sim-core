import { REFERENCE_BASES, REFERENCE_TERMS, REFERENCE_WINDOWS } from "../vocab"
import type { Check } from "./codes"
import { boundedInt, oneOf } from "./scalars"
import { checkShape, opt } from "./shape"

const multiplier = boundedInt(1, 100, "REFERENCE_MULTIPLIER_OUT_OF_RANGE")

/** The optional `reference` block: four closed fields, each optional, unknown keys rejected. */
export const reference: Check = (value, path, emit) => {
	checkShape(
		value,
		path,
		{
			multiplier: opt(multiplier),
			basis: opt(oneOf(REFERENCE_BASES, "INVALID_REFERENCE_BASIS")),
			window: opt(oneOf(REFERENCE_WINDOWS, "INVALID_REFERENCE_WINDOW")),
			terms: opt(oneOf(REFERENCE_TERMS, "INVALID_REFERENCE_TERMS")),
		},
		emit,
	)
}
