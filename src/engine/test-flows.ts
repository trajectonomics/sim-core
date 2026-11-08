/** TEST-ONLY flow builders. */
import type {
	AccountId,
	BasisPoints,
	ContributionFlow,
	DateString,
	ExpenseFlow,
	Frequency,
	Growth,
	IncomeFlow,
	MinorUnits,
} from "../types"

export interface FlowOptions {
	readonly start?: DateString
	readonly end?: DateString
	readonly frequency?: Frequency
	readonly growth?: Growth
	readonly label?: string
	readonly prepaymentBps?: BasisPoints
}

interface FlowBase {
	readonly id: string
	readonly amount: MinorUnits
	readonly frequency: Frequency
	readonly start: DateString
	readonly growth: Growth
	readonly end?: DateString
}

function base(id: string, amount: MinorUnits, options: FlowOptions): FlowBase {
	return {
		id,
		amount,
		frequency: options.frequency ?? "once",
		start: options.start ?? "2026-01-01",
		growth: options.growth ?? { bps: 0 },
		...(options.end === undefined ? {} : { end: options.end }),
	}
}

export function income(id: string, amount: MinorUnits, options: FlowOptions = {}): IncomeFlow {
	return {
		...base(id, amount, options),
		kind: "income",
		earned: true,
		...(options.label === undefined ? {} : { label: options.label }),
		...(options.prepaymentBps === undefined ? {} : { prepaymentBps: options.prepaymentBps }),
	}
}

export function expense(id: string, amount: MinorUnits, options: FlowOptions = {}): ExpenseFlow {
	return { ...base(id, amount, options), kind: "expense" }
}

export function contribution(
	id: string,
	target: AccountId,
	amount: MinorUnits,
	options: FlowOptions = {},
): ContributionFlow {
	return {
		...base(id, amount, options),
		kind: "contribution",
		target,
		...(options.label === undefined ? {} : { label: options.label }),
	}
}
