import type { Fixture } from "../fixtures/fixture"
import type { DateString } from "../types"
import type { ReferenceTerms, ReferenceWindow } from "../types/reference"
import { oracleAddMonthsClamped, oracleCountedDays } from "./oracle-date"
import { oracleDeflate } from "./oracle-money"
import { oraclePlanned } from "./oracle-planned"

const LAST_SUPPORTED_DATE = "9998-12-31"

export interface OracleSpan {
	readonly from: DateString
	readonly to: DateString
	readonly partial: boolean
}

/** A value in the reference's money: nominal, or deflated from its own date to Timeline.start. */
export function oracleRealValue(
	amount: bigint,
	fixture: Fixture,
	real: boolean,
	date: DateString,
): bigint {
	if (!real) return amount
	const days = oracleCountedDays(fixture.timeline.start, date)
	return oracleDeflate(amount, fixture.scenario.economy.inflation, days)
}

export function oracleSpan(
	fixture: Fixture,
	window: ReferenceWindow,
	month: DateString,
): OracleSpan {
	if (window === "next12Months") {
		const to = oracleAddMonthsClamped(month, 12)
		return { from: month, to, partial: to > LAST_SUPPORTED_DATE }
	}
	const start = oracleAddMonthsClamped(month, -12)
	const early = start < fixture.timeline.start
	return { from: early ? fixture.timeline.start : start, to: month, partial: early }
}

/** Planned expense amounts in the span, each deflated from its own Landed date before summing. */
export function oracleExpenses(fixture: Fixture, span: OracleSpan, terms: ReferenceTerms): bigint {
	const kinds = new Map(fixture.scenario.flows.map((flow) => [flow.id, flow.kind]))
	const real = terms === "real"
	let total = 0n
	for (const [date, day] of oraclePlanned(fixture)) {
		if (date < span.from || date >= span.to) continue
		for (const [id, amount] of day) {
			if (kinds.get(id) !== "expense") continue
			total += oracleRealValue(amount, fixture, real, date)
		}
	}
	return total
}
