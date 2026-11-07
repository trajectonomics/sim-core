export const SCHEMA_VERSION: 1 = 1

export const ACCOUNT_KINDS = ["asset", "liability"] as const
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
export const RESOLUTIONS = ["day", "month"] as const
export const MEASURE_OPS = ["const", "tally", "add", "sub", "min", "max", "scale", "pick"] as const
export const TALLY_BASES = ["gross", "funded"] as const
export const ROUNDINGS = ["floor", "halfUp", "ceil"] as const
