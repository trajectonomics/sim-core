import { describe, expect, it } from "bun:test"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { project } from "../engine/project"
import { financialIndependence } from "../index"
import type { SurvivalOptions } from "../types"
import { PARITY_CASES } from "./parity-cases"

interface Recorded {
	readonly name: string
	readonly sha256: string
	readonly options?: SurvivalOptions
	readonly fiSha256?: string
}

const recorded: readonly Recorded[] = JSON.parse(
	readFileSync(new URL("../../parity/cases.json", import.meta.url), "utf8"),
)

function hash(value: unknown): string {
	return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

describe("parity/cases.json", () => {
	it("lists exactly the parity cases", () => {
		expect(recorded.map((item) => item.name)).toEqual(PARITY_CASES.map((item) => item.name))
	})

	it.each(PARITY_CASES.map((item) => [item.name, item] as const))(
		"%s hashes as recorded (run `bun run parity:update` after an intended change)",
		(name, { fixture, options }) => {
			const { baseline, scenario, timeline } = fixture
			const record = recorded.find((item) => item.name === name)
			expect(hash(project(baseline, scenario, timeline))).toBe(record?.sha256 ?? "missing")
			if (options === undefined) return
			expect(hash(financialIndependence(baseline, scenario, timeline, options))).toBe(
				record?.fiSha256 ?? "missing",
			)
		},
	)
})
