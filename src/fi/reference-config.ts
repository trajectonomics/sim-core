import type {
	ReferenceBasis,
	ReferenceOptions,
	ReferenceTerms,
	ReferenceWindow,
} from "../types/reference"

/** The reference options with their defaults applied. */
export interface ReferenceConfig {
	readonly multiplier: number
	readonly basis: ReferenceBasis
	readonly window: ReferenceWindow
	readonly terms: ReferenceTerms
}

/** Omitting the block, or any field, keeps the historical 25× figure unchanged. */
export function referenceConfig(reference: ReferenceOptions | undefined): ReferenceConfig {
	return {
		multiplier: reference?.multiplier ?? 25,
		basis: reference?.basis ?? "unlockedAssets",
		window: reference?.window ?? "next12Months",
		terms: reference?.terms ?? "nominal",
	}
}
