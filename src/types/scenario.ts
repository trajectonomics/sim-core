import type { Account } from "./account"
import type { Calendar } from "./calendar"
import type { Cashflow } from "./cashflow"
import type { BasisPoints } from "./common"
import type { Flow } from "./flow"
import type { Levy } from "./levy"

export interface Economy {
	readonly inflation: BasisPoints
}

export interface Scenario {
	readonly schemaVersion: 4
	readonly currency: string
	readonly economy: Economy
	readonly accounts: readonly Account[]
	readonly flows: readonly Flow[]
	readonly cashflow: Cashflow
	readonly levies?: readonly Levy[]
	readonly calendar?: Calendar
}
