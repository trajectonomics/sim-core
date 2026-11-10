/** TEST-ONLY flow builders. */
import type {
	AccountId,
	BasisPoints,
	CappedPrepayment,
	ContributionFlow,
	DateString,
	Derive,
	ExpenseFlow,
	Frequency,
	Growth,
	IncomeFlow,
	IncomeRules,
	MinorUnits,
	Prepayment,
} from "../types"

export interface FlowOptions {
	readonly start?: DateString
	readonly end?: DateString
	readonly frequency?: Frequency
	readonly growth?: Growth
	readonly label?: string
	readonly earned?: boolean
	readonly prepayments?: readonly Prepayment[]
	readonly cappedPrepayment?: CappedPrepayment
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
		...layout(id, options),
		amount,
		growth: options.growth ?? { bps: 0 },
	}
}

/** The Flow fields a Derived flow also carries: no `amount` and no `growth`. */
function layout(id: string, options: FlowOptions): Omit<FlowBase, "amount" | "growth"> {
	return {
		id,
		frequency: options.frequency ?? "once",
		start: options.start ?? "2026-01-01",
		...(options.end === undefined ? {} : { end: options.end }),
	}
}

function labelOf(options: FlowOptions): { readonly label?: string } {
	return options.label === undefined ? {} : { label: options.label }
}

function incomeRules(options: FlowOptions): IncomeRules {
	return {
		kind: "income",
		earned: options.earned ?? true,
		...labelOf(options),
		...(options.prepayments === undefined ? {} : { prepayments: options.prepayments }),
		...(options.cappedPrepayment === undefined
			? {}
			: { cappedPrepayment: options.cappedPrepayment }),
	}
}

export function income(id: string, amount: MinorUnits, options: FlowOptions = {}): IncomeFlow {
	return { ...base(id, amount, options), ...incomeRules(options) }
}

/** An income Flow whose amount a Derived graph computes on each Occurrence. */
export function derivedIncome(id: string, derive: Derive, options: FlowOptions = {}): IncomeFlow {
	return { ...layout(id, options), ...incomeRules(options), derive }
}

/** An expense Flow whose amount a Derived graph computes on each Occurrence. */
export function derivedExpense(id: string, derive: Derive, options: FlowOptions = {}): ExpenseFlow {
	return { ...layout(id, options), kind: "expense", derive }
}

/** A contribution Flow whose amount a Derived graph computes on each Occurrence. */
export function derivedContribution(
	id: string,
	target: AccountId,
	derive: Derive,
	options: FlowOptions = {},
): ContributionFlow {
	return { ...layout(id, options), kind: "contribution", target, ...labelOf(options), derive }
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
	return { ...base(id, amount, options), kind: "contribution", target, ...labelOf(options) }
}

/** One Levy's share of an income Flow, for a test that names the Levy it credits. */
export function prepays(levy: string, bps: BasisPoints): readonly Prepayment[] {
	return [{ levy, bps }]
}
