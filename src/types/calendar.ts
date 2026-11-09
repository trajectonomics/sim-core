import type { DAY_RULES } from "../vocab"
import type { DateString } from "./common"

/** How Due dates move: `exact` keeps them, `next` moves each forward to a Business day. */
export type DayRule = (typeof DAY_RULES)[number]

/** The Scenario's Calendar: a closed day rule and the dates it lists as closed. */
export interface Calendar {
	readonly dayRule: DayRule
	readonly holidays: readonly DateString[]
}
