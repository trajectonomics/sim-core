import type { Fixture } from "../fixtures/fixture"
import type { ConstMeasure, DateString } from "../types"
import { oracleCalendar } from "./oracle-calendar"
import { oracleAmount, oracleEvents } from "./oracle-flow"
import { type OracleTallies, oracleConstValue, oracleDivide } from "./oracle-measure"

export interface OracleIncome {
	readonly date: DateString
	readonly flowId: string
	readonly label: string
	readonly amount: bigint
	readonly bps: number | undefined
	readonly capBps: number | undefined
	readonly cap: bigint | undefined
}

/** Levy `const` Measures by id, which are the only ones a cap may name. */
function constsOf(levy: Fixture["scenario"]["levy"]): ReadonlyMap<string, ConstMeasure> {
	const consts = new Map<string, ConstMeasure>()
	for (const measure of levy?.measures ?? []) {
		if (measure.op === "const") consts.set(measure.id, measure)
	}
	return consts
}

// BigInt has no Math.min.
function lesser(left: bigint, right: bigint): bigint {
	if (left < right) return left
	return right
}

function byDateThenId(left: OracleIncome, right: OracleIncome): number {
	if (left.date !== right.date) return left.date < right.date ? -1 : 1
	return left.flowId < right.flowId ? -1 : 1
}

function incomeOf(
	event: ReturnType<typeof oracleEvents>[number],
	consts: ReadonlyMap<string, ConstMeasure>,
	capDate: DateString,
	inflation: number,
): OracleIncome | undefined {
	const flow = event.flow
	if (flow.kind !== "income" || flow.label === undefined) return undefined
	const capped = flow.cappedPrepayment
	const upTo = capped === undefined ? undefined : consts.get(capped.upTo)
	return {
		date: event.date,
		flowId: flow.id,
		label: flow.label,
		amount: oracleAmount(event, inflation),
		bps: flow.prepaymentBps,
		capBps: capped?.bps,
		cap: upTo === undefined ? undefined : oracleConstValue(upTo, capDate, inflation),
	}
}

/**
 * Labeled income Occurrences of one Settlement period, in the engine's order (date, then Flow
 * id), with the cap each Flow names evaluated at `capDate` like the period's `due`.
 */
export function oracleIncomeEvents(
	fixture: Fixture,
	from: DateString,
	to: DateString,
	capDate: DateString,
): readonly OracleIncome[] {
	const consts = constsOf(fixture.scenario.levy)
	const inflation = fixture.scenario.economy.inflation
	const events = oracleEvents(fixture.scenario.flows, from, to, oracleCalendar(fixture))
	const incomes: OracleIncome[] = []
	for (const event of events) {
		if (event.date < from || event.date > to) continue
		const income = incomeOf(event, consts, capDate, inflation)
		if (income !== undefined) incomes.push(income)
	}
	return incomes.sort(byDateThenId)
}

/** Gross totals by label across the given income Occurrences. */
export function oracleTallies(incomes: readonly OracleIncome[]): OracleTallies {
	const gross = new Map<string, bigint>()
	for (const item of incomes) gross.set(item.label, (gross.get(item.label) ?? 0n) + item.amount)
	return { gross, funded: new Map() }
}

/** The capped share on the part of an Occurrence below the cap on its label's period-to-date gross. */
function cappedShare(item: OracleIncome, already: bigint): bigint {
	if (item.cap === undefined || item.capBps === undefined) return 0n
	const room = item.cap - already
	if (room <= 0n) return 0n
	return oracleDivide(lesser(room, item.amount) * BigInt(item.capBps), 10_000n, "halfUp")
}

/**
 * The period's Prepayment in minor units: each share half up, the capped one only on the part of
 * an Occurrence below the cap on its label's period-to-date gross (Carry-in included).
 */
export function oraclePrepaid(
	incomes: readonly OracleIncome[],
	startingGross: ReadonlyMap<string, bigint> = new Map(),
): bigint {
	const gross = new Map(startingGross)
	let prepaid = 0n
	for (const item of incomes) {
		if (item.bps !== undefined) {
			prepaid += oracleDivide(item.amount * BigInt(item.bps), 10_000n, "halfUp")
		}
		prepaid += cappedShare(item, gross.get(item.label) ?? 0n)
		gross.set(item.label, (gross.get(item.label) ?? 0n) + item.amount)
	}
	return prepaid
}
