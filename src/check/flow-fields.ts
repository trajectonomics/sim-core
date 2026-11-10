import type { Check } from "./codes"
import { boundedInt, str } from "./scalars"
import { checkShape, type Field, opt, req } from "./shape"

const prepayment: Check = boundedInt(0, 10_000, "RATE_OUT_OF_RANGE")

/** A field only a Levy gives meaning to: without one, it is reported instead of checked. */
function needsLevy(hasLevy: boolean, check: Check): Field {
	return opt((value, path, emit) => {
		if (hasLevy) check(value, path, emit)
		else emit("LEVY_REQUIRED", path)
	})
}

/** A field this kind of Flow never takes. */
export const NOT_ALLOWED: Field = opt((_value, path, emit) => emit("FIELD_NOT_ALLOWED", path))

export const label = (hasLevy: boolean): Field => needsLevy(hasLevy, str)
export const prepaymentBps = (hasLevy: boolean): Field => needsLevy(hasLevy, prepayment)

const cappedShape: Check = (value, path, emit) =>
	void checkShape(value, path, { bps: req(prepayment), upTo: req(str) }, emit)

/** The optional second Prepayment share and the Measure id it is capped at. */
export const cappedPrepayment = (hasLevy: boolean): Field => needsLevy(hasLevy, cappedShape)
