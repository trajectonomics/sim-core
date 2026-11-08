import type { BufferBreach } from "./buffer"
import type { Shortfall } from "./walk"

export interface BufferFailure {
	readonly month: string
	readonly breach: BufferBreach
}

export interface ShortfallFailure {
	readonly month: string
	readonly shortfall: Shortfall
}

/** Latest first breach date, then smallest deficit, then earliest month. */
export function bestBuffer(current: BufferFailure | undefined, next: BufferFailure): BufferFailure {
	if (current === undefined) return next
	if (next.breach.date !== current.breach.date) {
		return next.breach.date > current.breach.date ? next : current
	}
	const nextDeficit = next.breach.required - next.breach.accessible
	const currentDeficit = current.breach.required - current.breach.accessible
	if (nextDeficit !== currentDeficit) return nextDeficit < currentDeficit ? next : current
	return next.month < current.month ? next : current
}

/** Latest runs-out date, then smallest unmet amount, then earliest month. */
export function bestShortfall(
	current: ShortfallFailure | undefined,
	next: ShortfallFailure,
): ShortfallFailure {
	if (current === undefined) return next
	if (next.shortfall.date !== current.shortfall.date) {
		return next.shortfall.date > current.shortfall.date ? next : current
	}
	if (next.shortfall.unmet !== current.shortfall.unmet) {
		return next.shortfall.unmet < current.shortfall.unmet ? next : current
	}
	return next.month < current.month ? next : current
}
