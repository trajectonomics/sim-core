const CODES = [
	"UNSUPPORTED_SCHEMA_VERSION",
	"NOT_AN_OBJECT",
	"NOT_AN_ARRAY",
	"MISSING_KEY",
	"UNKNOWN_KEY",
	"WRONG_TYPE",
	"EMPTY_STRING",
	"NOT_SAFE_INTEGER",
	"NEGATIVE_AMOUNT",
	"INVALID_DATE",
	"INVALID_KIND",
	"INVALID_FREQUENCY",
	"INVALID_GROWTH",
	"INVALID_RESOLUTION",
	"HORIZON_BEFORE_START",
	"END_BEFORE_START",
	"ONCE_FLOW_END_MISMATCH",
	"DUPLICATE_ID",
	"UNKNOWN_ACCOUNT",
	"UNDECLARED_BALANCE_ACCOUNT",
	"LIABILITY_MISUSE",
	"SURPLUS_UNROUTED",
	"RATE_OUT_OF_RANGE",
	"INVALID_OP",
	"INVALID_BASIS",
	"INVALID_ROUNDING",
	"INVALID_DENOMINATOR",
	"INVALID_MONTH_DAY",
	"UNKNOWN_MEASURE",
	"MEASURE_CYCLE",
	"FIELD_NOT_ALLOWED",
	"LEVY_REQUIRED",
] as const

/** The closed set of problem codes. Frozen so consumers cannot mutate it at runtime. */
export const ERROR_CODES: typeof CODES = Object.freeze(CODES)

export type ErrorCode = (typeof CODES)[number]

/** Location of a problem: a segment is an object key or an array index. */
export type Path = readonly (string | number)[]

export interface Problem {
	readonly code: ErrorCode
	readonly path: Path
}

export type Emit = (code: ErrorCode, path: Path) => void

export type Check = (value: unknown, path: Path, emit: Emit) => void

/** Declared account id -> raw `kind` value from the scenario. */
export type AccountIndex = ReadonlyMap<string, unknown>
