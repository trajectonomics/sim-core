/** TEST-ONLY seeded Scenario generator; not imported by `src/index.ts`, so it stays out of the package. */
import { makeFixture } from "../engine/test-helpers"
import type { Fixture } from "../fixtures/fixture"
import type { SurvivalOptions } from "../types"
import type { Draw } from "./scan-draw"
import { shapedOptions, shapedSetup } from "./scan-shape"

export interface GeneratedCase {
	readonly name: string
	readonly fixture: Fixture
	readonly options: SurvivalOptions
}

function build(draw: Draw, index: number): GeneratedCase {
	const setup = shapedSetup(draw)
	return { name: `case-${index}`, fixture: makeFixture(setup), options: shapedOptions(draw) }
}

/** `count` deterministic scenarios from `seed`; the same seed always gives the same cases. */
export function generateCases(count: number, seed: bigint): readonly GeneratedCase[] {
	const draw: Draw = { state: seed }
	return Array.from({ length: count }, (_unused, index) => build(draw, index))
}
