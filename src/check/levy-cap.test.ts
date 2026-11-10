import { describe, expect, it } from "bun:test"
import { expected } from "../testing"
import { checkWith, flowsWith, LEVY } from "./levy-fixture"

const at = (index: number, ...rest: readonly (string | number)[]) =>
	["scenario", "flows", index, ...rest] as const

const capAt = (index: number, key?: string) =>
	at(index, "cappedPrepayment", ...(key === undefined ? [] : [key]))

/** The fixture Levy, injected into a cap that a test wrote without one. */
function withLevy(capped: unknown): unknown {
	if (typeof capped !== "object" || capped === null || Array.isArray(capped)) return capped
	return { levy: "levy", ...capped }
}

const incomeCap = (cappedPrepayment: unknown, prepaymentBps?: number) =>
	checkWith({
		levy: LEVY,
		flows: flowsWith(0, {
			label: "salary",
			...(prepaymentBps === undefined
				? {}
				: { prepayments: [{ levy: "levy", bps: prepaymentBps }] }),
			cappedPrepayment: withLevy(cappedPrepayment),
		}),
	})

describe("check() cappedPrepayment", () => {
	it("accepts a share and a const cap on a labeled income Flow with a Levy", () => {
		expect(incomeCap({ bps: 620, upTo: "cap" })).toEqual([])
		expect(incomeCap({ bps: 0, upTo: "cap" }, 10_000)).toEqual([])
		expect(incomeCap({ bps: 6200, upTo: "cap" }, 3800)).toEqual([])
	})

	it("rejects bps outside 0 to 10000 and a fractional share", () => {
		expect(incomeCap({ bps: 10_001, upTo: "cap" })).toEqual(
			expected("RATE_OUT_OF_RANGE", capAt(0, "bps")),
		)
		expect(incomeCap({ bps: -1, upTo: "cap" })).toEqual(
			expected("RATE_OUT_OF_RANGE", capAt(0, "bps")),
		)
		expect(incomeCap({ bps: 6.2, upTo: "cap" })).toEqual(
			expected("NOT_SAFE_INTEGER", capAt(0, "bps")),
		)
	})

	it("rejects a capped share that takes the two shares above 10000 basis points", () => {
		expect(incomeCap({ bps: 5001, upTo: "cap" }, 5000)).toEqual(
			expected("RATE_OUT_OF_RANGE", capAt(0, "bps")),
		)
		expect(incomeCap({ bps: 5000, upTo: "cap" }, 5000)).toEqual([])
	})

	it("counts every Levy's plain share against the capped one", () => {
		const flows = flowsWith(0, {
			label: "salary",
			prepayments: [
				{ levy: "levy", bps: 5000 },
				{ levy: "other", bps: 3000 },
			],
			cappedPrepayment: { levy: "levy", bps: 3000, upTo: "cap" },
		})
		const other = { ...(LEVY as object), id: "other" }
		expect(checkWith({ levies: [LEVY, other], flows })).toEqual(
			expected("RATE_OUT_OF_RANGE", capAt(0, "bps")),
		)
	})

	it("rejects the cap on a contribution and on an expense", () => {
		expect(checkWith({ levy: LEVY, flows: flowsWith(3, { cappedPrepayment: {} }) })).toEqual(
			expected("FIELD_NOT_ALLOWED", at(3, "cappedPrepayment")),
		)
		expect(checkWith({ levy: LEVY, flows: flowsWith(2, { cappedPrepayment: {} }) })).toEqual(
			expected("FIELD_NOT_ALLOWED", at(2, "cappedPrepayment")),
		)
	})

	it("rejects the cap and its label when the Scenario has no Levy", () => {
		const flows = flowsWith(0, {
			label: "salary",
			cappedPrepayment: { levy: "levy", bps: 620, upTo: "cap" },
		})
		expect(checkWith({ flows })).toEqual([
			{ code: "LEVY_REQUIRED", path: at(0, "label") },
			{ code: "LEVY_REQUIRED", path: at(0, "cappedPrepayment") },
		])
	})

	it("accepts a label no tally Measure reads: the cap only needs the gross", () => {
		const flows = flowsWith(0, {
			label: "untallied",
			cappedPrepayment: { levy: "levy", bps: 620, upTo: "cap" },
		})
		expect(checkWith({ levy: LEVY, flows })).toEqual([])
	})

	it("requires the label the cap is measured on", () => {
		const flows = flowsWith(0, { cappedPrepayment: { levy: "levy", bps: 620, upTo: "cap" } })
		expect(checkWith({ levy: LEVY, flows })).toEqual(expected("MISSING_KEY", at(0, "label")))
	})

	it("rejects a cap that names no Measure or names one that is not a const", () => {
		expect(incomeCap({ bps: 620, upTo: "ghost" })).toEqual(
			expected("UNKNOWN_MEASURE", capAt(0, "upTo")),
		)
		expect(incomeCap({ bps: 620, upTo: "share" })).toEqual(
			expected("CAP_NOT_CONST", capAt(0, "upTo")),
		)
	})

	it("rejects a const cap that is negative", () => {
		const levy = LEVY as { measures: readonly Readonly<Record<string, unknown>>[] }
		const measures = levy.measures.map((item) =>
			item["id"] === "cap" ? { ...item, value: -1 } : item,
		)
		expect(
			checkWith({
				levy: { ...levy, measures },
				flows: flowsWith(0, {
					label: "salary",
					cappedPrepayment: { levy: "levy", bps: 620, upTo: "cap" },
				}),
			}),
		).toEqual(expected("NEGATIVE_AMOUNT", capAt(0, "upTo")))
	})

	it("rejects an unknown key inside the cap", () => {
		expect(incomeCap({ bps: 620, upTo: "cap", asOf: "2026-01-01" })).toEqual(
			expected("UNKNOWN_KEY", capAt(0, "asOf")),
		)
	})

	it("returns problems for useless shapes instead of throwing", () => {
		expect(incomeCap([])).toEqual(expected("NOT_AN_OBJECT", capAt(0)))
		expect(incomeCap({})).toEqual([
			{ code: "MISSING_KEY", path: capAt(0, "bps") },
			{ code: "MISSING_KEY", path: capAt(0, "upTo") },
		])
		expect(incomeCap({ bps: "620", upTo: "" })).toEqual([
			{ code: "NOT_SAFE_INTEGER", path: capAt(0, "bps") },
			{ code: "EMPTY_STRING", path: capAt(0, "upTo") },
		])
	})
})
