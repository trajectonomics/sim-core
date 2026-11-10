import type { Check } from "./codes"
import { needsLevy, tallyLabel } from "./levy-fields"
import { boundedInt, str } from "./scalars"
import { checkShape, type Field, opt, req } from "./shape"

const prepayment: Check = boundedInt(0, 10_000, "RATE_OUT_OF_RANGE")

/** A field this kind of Flow never takes. */
export const NOT_ALLOWED: Field = opt((_value, path, emit) => emit("FIELD_NOT_ALLOWED", path))

export const label: (hasLevy: boolean) => Field = tallyLabel

const cappedShape: Check = (value, path, emit) =>
	void checkShape(value, path, { levy: req(str), bps: req(prepayment), upTo: req(str) }, emit)

/** The optional second Prepayment share, its Levy and the Measure id it is capped at. */
export const cappedPrepayment = (hasLevy: boolean): Field => needsLevy(hasLevy, cappedShape)
