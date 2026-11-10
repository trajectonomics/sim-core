/** TEST-ONLY scenario shaping for the seeded generator; not imported by `src/index.ts`. */
import { contribution, expense, income } from "../engine/test-flows"
import type { Setup } from "../engine/test-helpers"
import type {
	Account,
	DateString,
	Flow,
	Growth,
	MinorUnits,
	SurplusStep,
	SurvivalOptions,
} from "../types"
import { chance, type Draw, drawInt, oneOf } from "./scan-draw"

const ASSETS = ["cash", "brokerage", "ssf"] as const
const RATES = [0, 100, 300, 450, 700] as const
const GROWTH: readonly Growth[] = ["inflation", { bps: 0 }, { bps: 300 }]
const DAYS = ["01", "10", "15", "25", "31"] as const

function ledger(draw: Draw): readonly Account[] {
	const count = drawInt(draw, 1, 2)
	const accounts: Account[] = ASSETS.slice(0, count).map((id, index) => ({
		id,
		kind: "asset" as const,
		rate: oneOf(draw, RATES),
		...(index === 1 && chance(draw, 30) ? { lockedUntil: "2030-06-30" } : {}),
	}))
	if (chance(draw, 40))
		accounts.push({ id: "loan", kind: "liability", rate: oneOf(draw, [300, 500]) })
	return accounts
}

function flows(draw: Draw, asset: string, horizon: DateString): readonly Flow[] {
	const list: Flow[] = [
		income("pay", drawInt(draw, 200_000, 600_000), {
			frequency: "monthly",
			start: `2026-01-${oneOf(draw, DAYS)}`,
			growth: oneOf(draw, GROWTH),
		}),
		expense("living", drawInt(draw, 50_000, 250_000), {
			frequency: "monthly",
			start: `2026-01-${oneOf(draw, DAYS)}`,
			growth: "inflation",
		}),
	]
	if (chance(draw, 50)) {
		const year = drawInt(draw, 2026, Number(horizon.slice(0, 4)))
		list.push(expense("big", drawInt(draw, 500_000, 5_000_000), { start: `${year}-03-15` }))
	}
	if (chance(draw, 40)) {
		const dividend = income("dividend", drawInt(draw, 50_000, 300_000), { frequency: "annual" })
		list.push({ ...dividend, earned: false })
	}
	if (chance(draw, 60)) {
		list.push(
			contribution("save", asset, drawInt(draw, 20_000, 150_000), { frequency: "quarterly" }),
		)
	}
	return list
}

function surplus(draw: Draw, assets: readonly string[]): readonly SurplusStep[] {
	const first: SurplusStep = {
		account: assets[0]!,
		...(assets[1] === undefined ? {} : { upTo: drawInt(draw, 500_000, 5_000_000) }),
	}
	return assets[1] === undefined ? [first] : [first, { account: assets[1] }]
}

export function shapedSetup(draw: Draw): Setup {
	const years = drawInt(draw, 2, 5)
	const accounts = ledger(draw)
	const assets = accounts.filter((account) => account.kind === "asset").map((account) => account.id)
	const balances: Record<string, MinorUnits> = Object.fromEntries(
		accounts.map((account) => [account.id, drawInt(draw, 0, 2_000_000)]),
	)
	const horizon = `${2026 + years}-01-01`
	return {
		accounts,
		balances,
		flows: flows(draw, assets[0]!, horizon),
		surplus: surplus(draw, assets),
		contribute: [assets[0]!],
		withdraw: assets,
		horizon,
		inflation: oneOf(draw, [0, 100, 200, 400]),
		...(chance(draw, 25)
			? { calendar: { dayRule: "next" as const, holidays: ["2026-04-06", "2027-04-06"] } }
			: {}),
	}
}

export function shapedOptions(draw: Draw): SurvivalOptions {
	const buffer = oneOf(draw, [0, 0, 3, 6])
	const spending = chance(draw, 30)
		? {
				retirementSpending: {
					amount: drawInt(draw, 50_000, 200_000),
					growth: "inflation" as const,
				},
			}
		: {}
	return { method: "survival", ...(buffer === 0 ? {} : { minBufferMonths: buffer }), ...spending }
}
