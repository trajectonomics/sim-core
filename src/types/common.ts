import type { COMPOUNDING_PERIODS, FREQUENCIES, RESOLUTIONS } from "../vocab"

/** Calendar date, `YYYY-MM-DD`. */
export type DateString = string

/** Integer minor units (cents, satang). Always a safe integer. */
export type MinorUnits = number

/** Integer basis points (1 bps = 0.01%). Always a safe integer. */
export type BasisPoints = number

/** Opaque account identifier. */
export type AccountId = string

export type Frequency = (typeof FREQUENCIES)[number]
export type Resolution = (typeof RESOLUTIONS)[number]

/** The calendar period at whose end accrued interest is capitalised. */
export type CompoundingPeriod = (typeof COMPOUNDING_PERIODS)[number]

/** `"inflation"` follows `economy.inflation`; `{ bps }` is a fixed yearly step (may be negative). */
export type Growth = "inflation" | { readonly bps: BasisPoints }
