import type { Growth, MinorUnits } from "../types"
import type {
	ProbabilityDefinition,
	ProbabilityThresholdOptions,
	SurvivalDefinition,
	SurvivalOptions,
} from "../types/financial-independence"

/** Snapshots the shared optional fields so a later mutation of `options` cannot reach a result. */
export function spendingSnapshot(spending: {
	readonly amount: MinorUnits
	readonly growth: Growth
}): { readonly retirementSpending: { readonly amount: MinorUnits; readonly growth: Growth } } {
	return {
		retirementSpending: {
			amount: spending.amount,
			growth: typeof spending.growth === "string" ? spending.growth : { bps: spending.growth.bps },
		},
	}
}

export function survivalDefinition(options: SurvivalOptions): SurvivalDefinition {
	return {
		method: options.method,
		...(options.retirementSpending === undefined
			? {}
			: spendingSnapshot(options.retirementSpending)),
		...(options.minBufferMonths === undefined ? {} : { minBufferMonths: options.minBufferMonths }),
		definitionVersion: 1,
	}
}

export function probabilityDefinition(
	options: ProbabilityThresholdOptions,
	modelId: string,
): ProbabilityDefinition {
	return {
		method: options.method,
		thresholdBps: options.thresholdBps,
		paths: options.paths,
		seed: options.seed,
		modelId,
		...(options.retirementSpending === undefined
			? {}
			: spendingSnapshot(options.retirementSpending)),
		...(options.minBufferMonths === undefined ? {} : { minBufferMonths: options.minBufferMonths }),
		definitionVersion: 1,
	}
}
