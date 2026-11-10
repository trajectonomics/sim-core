import type { Check } from "./codes"
import { str } from "./scalars"
import { type Field, opt } from "./shape"

/** A field only a Levy gives meaning to: without one, it is reported instead of checked. */
export function needsLevy(hasLevy: boolean, check: Check): Field {
	return opt((value, path, emit) => {
		if (hasLevy) check(value, path, emit)
		else emit("LEVY_REQUIRED", path)
	})
}

/** A Tally label on a Flow or an Account, which needs a Levy in the Scenario. */
export const tallyLabel = (hasLevy: boolean): Field => needsLevy(hasLevy, str)
