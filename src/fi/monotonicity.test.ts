import { describe, expect, it } from "bun:test"
import { buildEvents } from "../engine/events"
import { project } from "../engine/project"
import { financialIndependence } from "../index"
import { bufferDate, levyBand, retirementGap, upToCap } from "./named-cases"
import { planScan } from "./plan"
import { generateCases } from "./scan-generator"
import { type CandidateResult, scanPattern } from "./scan-probe"
import { search } from "./search"

/** The pattern with consecutive repeats collapsed: `pfp` means a pass, then a fail, then a pass. */
function shape(results: readonly CandidateResult[]): string {
	let out = ""
	for (const result of results) if (out.at(-1) !== result[0]) out += result[0]
	return out
}

function firstMonth(pattern: ReturnType<typeof scanPattern>, result: CandidateResult): string {
	const index = pattern.results.indexOf(result)
	return pattern.months[index]!
}

describe("survival is not monotone in the candidate month", () => {
	it("retirement spending: stopping before a big expense removes it, one month later it is paid", () => {
		const pattern = scanPattern(retirementGap.fixture, retirementGap.options)
		expect(shape(pattern.results)).toBe("pfp")
		expect(firstMonth(pattern, "pass")).toBe("2026-01-01")
		expect(pattern.months[pattern.results.indexOf("fail")]).toBe("2026-07-01")
	})

	it("a Levy band: a mid-year stop pays the due a full-year tally avoids", () => {
		const pattern = scanPattern(levyBand.fixture, levyBand.options)
		expect(shape(pattern.results)).toBe("pfp")
		expect(pattern.months[pattern.results.indexOf("fail")]).toBe("2026-08-01")
		expect(pattern.months[pattern.results.lastIndexOf("fail") + 1]).toBe("2026-11-01")
	})

	it("checks the Minimum buffer at the candidate month itself, where nothing lands", () => {
		const pattern = scanPattern(bufferDate.fixture, bufferDate.options)
		expect(shape(pattern.results)).toBe("pfp")
		expect(firstMonth(pattern, "pass")).toBe("2026-01-01")
		expect(pattern.months[pattern.results.indexOf("fail")]).toBe("2026-02-01")
		const plan = planScan(
			bufferDate.fixture.baseline,
			bufferDate.fixture.scenario,
			bufferDate.fixture.timeline,
			bufferDate.options,
		)
		expect(search(plan!.input, ["2026-02-01"])).toMatchObject({
			kind: "unreachable",
			buffer: { breach: { date: "2026-02-01" } },
		})
		const { scenario, timeline } = bufferDate.fixture
		const events = buildEvents(scenario, timeline, undefined)
		expect(events.some((event) => event.date === "2026-02-01")).toBe(false)
	})

	// ADR 0004 also records a pass/fail/pass from this rounding with no buffer. That pattern needs
	// the expense that decides a Shortfall to land inside a one-minor-unit gap between two
	// candidates, so no stable fixture exists; this test pins the mechanism the rounding comes from.
	it("a filled-up surplus cap skips the commit, so the account keeps its old date", () => {
		const { baseline, scenario, timeline } = upToCap.fixture
		const result = project(baseline, scenario, { ...timeline, resolution: "month" })
		if (!result.ok) throw new Error(JSON.stringify(result.problems))
		const balanceAt = (date: string, account: string) =>
			result.projection.rows
				.find((row) => row.date === date)
				?.balances.find((balance) => balance.account === account)?.amount
		// The cap binds from February, so that fill is zero and the whole surplus spills instead;
		// the account is never committed again and is valued from its January date.
		expect(balanceAt("2026-03-01", "spill")).toBe(100_000)
		expect(balanceAt("2026-03-01", "capped")).toBe(107_540)
	})
})

describe("the seeded scan generator", () => {
	it("is deterministic and only emits Scenarios the engine accepts", () => {
		const first = generateCases(8, 2n)
		const second = generateCases(8, 2n)
		expect(JSON.stringify(second)).toBe(JSON.stringify(first))
		for (const generated of first) {
			const { baseline, scenario, timeline } = generated.fixture
			expect(financialIndependence(baseline, scenario, timeline, generated.options).ok).toBe(true)
		}
	})

	it("documents a counterexample: seed 2 already walks a fail/pass/fail/pass", () => {
		const shapes = generateCases(8, 2n).map((generated) =>
			shape(scanPattern(generated.fixture, generated.options).results),
		)
		expect(shapes[7]).toBe("fpfp")
	})
})
