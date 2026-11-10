export const BASELINE_SCHEMA_VERSION: 1 = 1
export const SCENARIO_SCHEMA_VERSION: 3 = 3

export const ACCOUNT_KINDS = ["asset", "liability"] as const
export const COMPOUNDING_PERIODS = ["monthly", "quarterly", "semiannual", "annual"] as const
export const FI_METHODS = ["survival", "probabilityThreshold"] as const
export const FLOW_KINDS = ["income", "expense", "contribution"] as const
export const FREQUENCIES = [
	"once",
	"daily",
	"weekly",
	"biweekly",
	"monthly",
	"quarterly",
	"annual",
] as const
export const DAY_RULES = ["exact", "next"] as const
export const RESOLUTIONS = ["day", "month"] as const
export const MEASURE_OPS = [
	"const",
	"tally",
	"add",
	"sub",
	"min",
	"max",
	"scale",
	"mul",
	"pick",
] as const
export const TALLY_BASES = ["gross", "funded", "returns", "gains"] as const
export const ROUNDINGS = ["floor", "halfUp", "ceil"] as const
