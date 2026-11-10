/** TEST-ONLY deterministic draw helpers for the scenario generator; not imported by `src/index.ts`. */
import { nextSplitMix } from "../prng/splitmix64"

export interface Draw {
	state: bigint
}

/** A uniform integer in `[low, high]`, consuming one SplitMix64 word. */
export function drawInt(draw: Draw, low: number, high: number): number {
	const step = nextSplitMix(draw.state)
	draw.state = step.state
	return low + Number(step.word % BigInt(high - low + 1))
}

export function chance(draw: Draw, percent: number): boolean {
	return drawInt(draw, 1, 100) <= percent
}

export function oneOf<T>(draw: Draw, items: readonly T[]): T {
	return items[drawInt(draw, 0, items.length - 1)]!
}
