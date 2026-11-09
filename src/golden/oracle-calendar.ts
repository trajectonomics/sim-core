import type { Fixture } from "../fixtures/fixture"
import type { DateString } from "../types"
import { oracleAddDays, oracleOrdinal } from "./oracle-date"

export interface OracleCalendar {
	readonly holidays: ReadonlySet<DateString>
}

/** Ordinal 0 (0001-01-01) is a Monday, so the table's last two entries are the weekend. */
const WEEKEND = [false, false, false, false, false, true, true] as const

/** The oracle's own weekday table and list membership: it shares nothing with `calendar/`. */
export function oracleBusinessDay(date: DateString, calendar: OracleCalendar | undefined): boolean {
	if (calendar === undefined) return true
	return WEEKEND[oracleOrdinal(date) % 7] !== true && !calendar.holidays.has(date)
}

/** Walks one day at a time until the date is a Business day. */
export function oracleLand(date: DateString, calendar: OracleCalendar | undefined): DateString {
	let current = date
	while (!oracleBusinessDay(current, calendar)) current = oracleAddDays(current, 1)
	return current
}

/** The last Business day strictly before `date`: the last Due date that lands before it. */
export function oracleLastBusinessDayBefore(
	date: DateString,
	calendar: OracleCalendar | undefined,
): DateString {
	let current = oracleAddDays(date, -1)
	while (!oracleBusinessDay(current, calendar)) current = oracleAddDays(current, -1)
	return current
}

/** The Calendar the oracle applies, read from the Scenario: absent or `exact` means none. */
export function oracleCalendar(fixture: Fixture): OracleCalendar | undefined {
	const calendar = fixture.scenario.calendar
	if (calendar === undefined || calendar.dayRule !== "next") return undefined
	return { holidays: new Set(calendar.holidays) }
}
