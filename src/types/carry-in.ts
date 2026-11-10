import type { DateString, MinorUnits } from "./common"
import type { TallyBasis } from "./measure"

/** One tally already recorded for a Settlement period that began before `start`. */
export interface CarryInTally {
	readonly label: string
	readonly basis: TallyBasis
	readonly amount: MinorUnits
}

/** The tallies and Prepayment already recorded for one period before the Timeline start. */
export interface CarryIn {
	readonly periodStart: DateString
	readonly tallies: readonly CarryInTally[]
	readonly prepaid: MinorUnits
}
