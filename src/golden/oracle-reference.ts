import type { Fixture } from "../fixtures/fixture"
import type { DateString } from "../types"
import type { Account } from "../types/account"
import type { ReferenceBasis, ReferenceOptions } from "../types/reference"
import { oracleAddDays } from "./oracle-date"
import { oracleExpenses, oracleRealValue, oracleSpan } from "./oracle-reference-window"
import { oracleRun } from "./oracle-sim"
import { type OracleStates, oracleValueParts } from "./oracle-state"

export interface OracleReference {
	readonly unlockedAssets: bigint
	readonly numerator: bigint
	readonly annualExpenses: bigint
	readonly threshold: bigint
	readonly multipleBps?: bigint
	readonly partial: boolean
	readonly met: boolean
}

function included(basis: ReferenceBasis, liability: boolean, locked: boolean): boolean {
	if (basis === "netWorth") return true
	if (basis === "allAssets") return !liability
	if (basis === "accessibleNetWorth") return !locked
	return !liability && !locked
}

interface Part {
	readonly counted: boolean
	readonly counts: boolean
	readonly liability: boolean
}

function partOf(rule: Account, date: DateString, basis: ReferenceBasis): Part {
	const liability = rule.kind === "liability"
	const locked = !liability && rule.lockedUntil !== undefined && date < rule.lockedUntil
	return { counted: !liability && !locked, counts: included(basis, liability, locked), liability }
}

function floorDiv(numerator: bigint, denominator: bigint): bigint {
	const quotient = numerator / denominator
	const remainder = numerator % denominator
	return remainder !== 0n && numerator < 0n !== denominator < 0n ? quotient - 1n : quotient
}

function add(totals: { unlockedAssets: bigint; numerator: bigint }, part: Part, value: bigint) {
	if (part.counted) totals.unlockedAssets += value
	if (part.counts) totals.numerator += part.liability ? -value : value
}

function sums(
	states: OracleStates,
	month: DateString,
	basis: ReferenceBasis,
	fixture: Fixture,
	real: boolean,
): { readonly unlockedAssets: bigint; readonly numerator: bigint } {
	const totals = { unlockedAssets: 0n, numerator: 0n }
	for (const state of states.values()) {
		const part = partOf(state.rule, month, basis)
		if (!part.counted && !part.counts) continue
		const amount = oracleValueParts(state, month).amount
		add(totals, part, oracleRealValue(amount, fixture, real, month))
	}
	return totals
}

/** Replays the Projection to the day before `month`; the reference is measured before its flows. */
function statesBefore(fixture: Fixture, month: DateString): OracleStates | undefined {
	const before = oracleAddDays(month, -1)
	if (before < fixture.timeline.start) return undefined
	const truncated = { ...fixture, timeline: { ...fixture.timeline, horizon: before } }
	return oracleRun(truncated, []).states
}

/** The naive reference: a rational multiple of the planned expenses, never annualised. */
export function oracleReference(
	fixture: Fixture,
	month: DateString,
	reference: ReferenceOptions | undefined,
): OracleReference | undefined {
	const states = statesBefore(fixture, month)
	if (states === undefined) return undefined
	const terms = reference?.terms ?? "nominal"
	const basis = reference?.basis ?? "unlockedAssets"
	const parts = sums(states, month, basis, fixture, terms === "real")
	const span = oracleSpan(fixture, reference?.window ?? "next12Months", month)
	const annualExpenses = oracleExpenses(fixture, span, terms)
	const threshold = BigInt(reference?.multiplier ?? 25) * annualExpenses
	const multipleBps =
		annualExpenses === 0n ? undefined : floorDiv(parts.numerator * 10000n, annualExpenses)
	return {
		...parts,
		annualExpenses,
		threshold,
		...(multipleBps === undefined ? {} : { multipleBps }),
		partial: span.partial,
		met: parts.numerator >= threshold,
	}
}
