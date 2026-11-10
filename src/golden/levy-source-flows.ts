/** Shared Flows and rules for the two Levy tally-source parity fixtures. */
import type { Account, Flow, Timeline } from "../types"

export const salary: Flow = {
	id: "salary",
	kind: "income",
	earned: true,
	amount: 10_000_000,
	frequency: "monthly",
	start: "2026-01-25",
	growth: { bps: 0 },
	label: "salary",
}

export const living: Flow = {
	id: "living",
	kind: "expense",
	amount: 2_000_000,
	frequency: "monthly",
	start: "2026-01-01",
	growth: "inflation",
}

export const cash: Account = { id: "cash", kind: "asset", rate: 0 }
export const deposit: Account = {
	id: "deposit",
	kind: "asset",
	rate: 1000,
	returnLabel: "interest",
}
export const pension: Account = {
	id: "pension",
	kind: "asset",
	rate: 500,
	lockedUntil: "2035-01-01",
}
export const brokerage: Account = { id: "brokerage", kind: "asset", rate: 500, gainLabel: "gain" }

export const timeline: Timeline = {
	start: "2026-01-01",
	horizon: "2028-06-30",
	resolution: "day",
}
