import type { DateString } from "../types"
import type { BufferBreach } from "./buffer"
import type { Shortfall } from "./walk"

export interface BufferFailure {
	readonly month: DateString
	readonly breach: BufferBreach
}

export interface ShortfallFailure {
	readonly month: DateString
	readonly shortfall: Shortfall
}

function better<T>(
	current: T | undefined,
	next: T,
	dateOf: (failure: T) => string,
	metricOf: (failure: T) => bigint,
	monthOf: (failure: T) => string,
): T {
	if (current === undefined) return next
	if (dateOf(next) !== dateOf(current)) return dateOf(next) > dateOf(current) ? next : current
	if (metricOf(next) !== metricOf(current)) {
		return metricOf(next) < metricOf(current) ? next : current
	}
	return monthOf(next) < monthOf(current) ? next : current
}

/** Latest first breach date, then smallest deficit, then earliest month. */
export function bestBuffer(current: BufferFailure | undefined, next: BufferFailure): BufferFailure {
	return better(
		current,
		next,
		(failure) => failure.breach.date,
		(failure) => failure.breach.required - failure.breach.accessible,
		(failure) => failure.month,
	)
}

/** Latest runs-out date, then smallest unmet amount, then earliest month. */
export function bestShortfall(
	current: ShortfallFailure | undefined,
	next: ShortfallFailure,
): ShortfallFailure {
	return better(
		current,
		next,
		(failure) => failure.shortfall.date,
		(failure) => failure.shortfall.unmet,
		(failure) => failure.month,
	)
}
