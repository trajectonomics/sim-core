import type { Fixture } from "../fixtures/fixture"
import type { ConstMeasure, DateString, Levy } from "../types"
import { isFixed } from "../types"
import { oracleCalendar } from "./oracle-calendar"
import { oracleAmount, oracleEvents } from "./oracle-flow"
import { type OracleTallies, oracleConstValue } from "./oracle-measure"

export interface OracleShare {
	readonly levy: string
	readonly bps: number
}

export interface OracleIncome {
	readonly date: DateString
	readonly flowId: string
	readonly label: string
	readonly amount: bigint
	readonly shares: readonly OracleShare[]
	readonly capBps: number | undefined
	readonly cap: bigint | undefined
	readonly capLevy: string | undefined
}

/** A Levy `const` Measure by its Levy id and Measure id. */
function constKey(levy: string, measure: string): string {
	return `${levy}\u0000${measure}`
}

function constsOf(levies: readonly Levy[] | undefined): ReadonlyMap<string, ConstMeasure> {
	const consts = new Map<string, ConstMeasure>()
	for (const levy of levies ?? []) {
		for (const measure of levy.measures) {
			if (measure.op === "const") consts.set(constKey(levy.id, measure.id), measure)
		}
	}
	return consts
}

function byDateThenId(left: OracleIncome, right: OracleIncome): number {
	if (left.date !== right.date) return left.date < right.date ? -1 : 1
	return left.flowId < right.flowId ? -1 : 1
}

function incomeOf(
	event: ReturnType<typeof oracleEvents>[number],
	consts: ReadonlyMap<string, ConstMeasure>,
	capDate: DateString,
	capPeriodEnd: DateString,
	inflation: number,
): OracleIncome | undefined {
	const flow = event.flow
	if (flow.kind !== "income" || flow.label === undefined || !isFixed(flow)) return undefined
	const capped = flow.cappedPrepayment
	const upTo = capped === undefined ? undefined : consts.get(constKey(capped.levy, capped.upTo))
	return {
		date: event.date,
		flowId: flow.id,
		label: flow.label,
		amount: oracleAmount(event, inflation),
		shares: flow.prepayments ?? [],
		capBps: capped?.bps,
		cap: upTo === undefined ? undefined : oracleConstValue(upTo, capDate, inflation, capPeriodEnd),
		capLevy: capped?.levy,
	}
}

/**
 * Labeled income Occurrences of one Settlement period, in the engine's order (date, then Flow
 * id), with the cap each Flow names evaluated at `capDate` and its period's last day.
 */
export function oracleIncomeEvents(
	fixture: Fixture,
	from: DateString,
	to: DateString,
	capDate: DateString,
	capPeriodEnd: DateString = to,
): readonly OracleIncome[] {
	const consts = constsOf(fixture.scenario.levies)
	const inflation = fixture.scenario.economy.inflation
	const events = oracleEvents(fixture.scenario.flows, from, to, oracleCalendar(fixture))
	const incomes: OracleIncome[] = []
	for (const event of events) {
		if (event.date < from || event.date > to) continue
		const income = incomeOf(event, consts, capDate, capPeriodEnd, inflation)
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

export {
	oraclePlainShares,
	oraclePrepaid,
	oraclePrepaidByLevy,
} from "./oracle-shares"
