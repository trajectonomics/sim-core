# Exact integer compounding with lazy per-account commits

Status: accepted

Projections must be byte-identical across runtimes, and a V8/JavaScriptCore comparison showed `Math.pow`/`exp`/`log` disagree on 228 of 10,296 results. So all growth is BigInt integer arithmetic, and `Account.rate` is an **effective annual rate**: one year grows a balance by exactly `rate`, whatever the compounding period.

- **Daily factor.** `f` is the largest integer with `10000·f^365 ≤ (10000+r)·10^(30·365)` (scale 10^30). It is unique, so an independent oracle reproduces it bit for bit.
- **Whole years are exact.** A gap of `n` counted days is `365·y + d`. Growth is `(10000+r)^y · f^d` over `10000^y · 10^(30d)`, rounded once, half-up (balances are never negative). Using `f^n` alone would make a 50% year land just below the tie and round the wrong way, and would mean million-digit BigInts for long gaps.
- **Day count is Actual/365 No Leap.** Counted days are actual days minus the Feb 29s in `(from, to]`, so any date-to-same-date-next-year span is exactly 365 counted days.
- **Lazy per-account commit.** An account's `(balance, asOf)` is committed only when a flow, surplus fill or withdrawal touches it. Rows and `upTo` or withdraw checks use a read-only valuation. Committing every account on every occurrence would freeze small balances (10 satang at 4% earns 0.0075 a week, rounded to 0 forever) and let unrelated flows change every account's result. It would also make day and month resolution disagree.

## Considered options

- **Fixed-point daily factor raised to `n` by squaring.** Result depends on the exact squaring and truncation sequence, so an oracle must copy the algorithm rather than the spec.
- **Nominal rate with a compounding period.** Needed for loans whose law or contract fixes the period. Deferred to #14; the default stays effective annual.
- **Calendar-year 365/366 roots.** Exact only for Jan 1 to Dec 31, not for an arbitrary 12-month span.

## Consequences

- Rates must be greater than -10000 bps (the root does not exist at or below it); `check()` enforces it.
- Interest for the same inputs differs by a unit or two from a naive monthly-compounding calculator. That is intended.
- A Return-series run rounds once per held Return row rather than once per span, because a span
  return is not an effective annual rate; see ADR-0005. Every run without a series rounds exactly as
  above.
- **Exceptions.** ADR-0007 names the two places this rule does not hold for a nominal Account:
  `rate` is a nominal annual rate when `compounding` is present (a full period earns `rate / m`,
  not an effective annual share), and a read may commit completed capitalisations at compounding
  dates. The effective-annual path itself is unchanged.
