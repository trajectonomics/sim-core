/** TEST-ONLY hand-computed salary Scenario for the Levy engine tests. */
import { TH_LIKE } from "../levy/th-levy"
import type { BasisPoints, DateString, Flow, MinorUnits, Resolution } from "../types"
import { income } from "./test-flows"
import type { Setup } from "./test-helpers"

export const SALARY = 10_000_000
export const NET_500 = 9_500_000
export const NET_1000 = 9_000_000
export const PREPAID_500 = 500_000
export const PREPAID_1000 = 1_000_000
export const DUE_2026 = 11_500_000

export interface SalarySetupOptions {
	readonly prepaymentBps?: BasisPoints
	readonly flows?: readonly Flow[]
	readonly balances?: Readonly<Record<string, MinorUnits>>
	readonly horizon?: DateString
	readonly resolution?: Resolution
	readonly withdraw?: readonly string[]
}

/** One salaried calendar year (2026) under TH_LIKE, settling on 31 March 2027. */
export function salaryLevySetup(options: SalarySetupOptions = {}): Setup {
	const prepaymentBps = options.prepaymentBps ?? 500
	return {
		accounts: [{ id: "cash", kind: "asset", rate: 0 }],
		balances: options.balances ?? { cash: 0 },
		flows: options.flows ?? [
			income("salary", SALARY, {
				frequency: "monthly",
				start: "2026-01-31",
				label: "salary",
				prepaymentBps,
			}),
		],
		surplus: [{ account: "cash" }],
		withdraw: options.withdraw ?? ["cash"],
		start: "2026-01-01",
		horizon: options.horizon ?? "2027-03-31",
		resolution: options.resolution ?? "day",
		levy: TH_LIKE,
	}
}
