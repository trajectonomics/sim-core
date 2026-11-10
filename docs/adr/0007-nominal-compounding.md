# Nominal-rate accounts and calendar compounding periods

Status: accepted

`Account.rate` was effective annual only (ADR 0001). A loan whose contract, or a savings product
whose law, fixes a **nominal** rate and a compounding period — "7% nominal, compounded monthly" —
could not be represented: a caller had to pre-compute an effective annual rate, which is generally
not an integer number of basis points, loses the legal period, and cannot show the month-end
interest charge. This ADR adds the primitive and records the two breaking changes it brings.

## Decision

- **Presence of `compounding` discriminates.** `Account` gains an optional `compounding` of
  `"monthly" | "quarterly" | "semiannual" | "annual"`. Present, `rate` is a nominal annual rate;
  absent, `rate` stays the effective annual rate of ADR 0001. There is no separate `rateBasis`
  field, so an existing Account cannot acquire a second meaning by omission.
- **Calendar-aligned periods.** A period is a calendar month, quarter, half-year or year, and its
  last day is the **compounding date**. Compounding dates depend on nothing but the calendar: not
  `Timeline.start`, the Baseline, Flow dates or Account ids. A period is the inclusive range from
  its first day to its last day. The accrual period is the one containing the day after `asOf`, so
  a period whose compounding date is `asOf` has already closed.
- **Periodic rate and counted days.** A full period earns `rate / m`, with `m` of 12, 4, 2 or 1. A
  partial period earns that fraction pro-rated by Actual/365 No Leap counted days within the
  period: `capitalised × rate × elapsedCountedDays / (10000 × m × periodCountedDays)`, where
  `periodCountedDays` is the whole period's counted length (28 for February 2024, because Feb 29
  is not counted). A full period is therefore exactly `rate / m` whatever the month length.
- **Exact numerator, one rounding.** Interest is carried as `capitalisedDays`, the sum of the
  capitalised balance over the counted days of the current period. Its denominator is
  `D = 10000 × m × periodCountedDays`, and Accrued interest is
  `roundHalfUp(capitalisedDays × rate, D)`. The numerator is exact, so a Flow does not round the
  accrued amount; rounding happens when an integer is needed — a capitalisation, a row, a cap or
  a debit. This avoids ADR 0001's repeated-commit freeze inside a period.
- **A row reports the Account's value.** `capitalised + accruedInterest`, where `capitalised` is
  the capitalised balance and Accrued interest is part of Net worth and of every routing
  valuation. At a compounding date the engine accrues that day, capitalises, and only then
  applies the day's Flows, so the row reports `accruedInterest = 0` and the same total. Capitalisation changes only
  how future interest is computed.
- **Capitalised-first debits, with a settlement exception.** A debit reduces the capitalised
  balance and leaves Accrued interest to capitalise on the Compounding date. A debit that would
  take the capitalised balance below zero first capitalises the Accrued interest at the debit
  date, then applies the remainder: that is a
  settlement, not periodic compounding. It is the only early capitalisation. The existing caps
  (a Liability payment is `min(planned, valuation)`, a withdrawal is `min(remaining, valuation)`)
  use the same valuation including Accrued interest, so a payment can clear the Account and the
  reported value never goes negative.
- **Reads may advance completed capitalisations.** Valuation is read-only for the current partial
  period: it walks a local copy and never commits its rounding. It may commit capitalisations at
  completed compounding dates, because those are fixed calendar dates and the partial-period
  numerator is untouched. This amends ADR 0001's "reads never commit" for that case only, and keeps
  day-resolution reads linear. A mutation commits the same walk and then applies the delta.
- **Zero and tiny balances.** A nominal Account whose periodic interest rounds to zero at every
  capitalisation does not grow (10 satang at 4% nominal monthly). That is the granularity of the
  stated capitalisation period, not a bug; the effective-annual daily factor exists to avoid it
  there. Nominal rates are non-negative in this slice, so the capitalisation rounding is half up.
- **Break one: Scenario v3.** `Scenario.schemaVersion` and `SCENARIO_SCHEMA_VERSION` become `3`;
  `Baseline.schemaVersion` stays `1`. `check()` reports `UNSUPPORTED_SCHEMA_VERSION` at
  `["scenario", "schemaVersion"]` and skips the rest of the Scenario. Unlike ADR 0003's v2 bump,
  which a required `contribute` list forced, this bump is **owner-chosen** because the repository
  has no clients; an optional field would not have forced it.
- **Break two: the row balance type.** A row's `balances` and `realBalances` items become the
  exported `ProjectionBalance { account, amount, capitalised, accruedInterest }` in that field
  order, which fixes `JSON.stringify` order and therefore the parity hash. `amount` stays the total;
  effective-annual Accounts report `accruedInterest = 0` and `capitalised = amount`. Real values
  deflate each component and set `real.amount` to their sum, so the components win when the sum
  differs by a minor unit from deflating the total. `ProjectionRow.netWorth` and
  `accessibleNetWorth` stay totals, and `AnnualRollup` is unchanged, its `interest` residual now
  including nominal interest.
- **The Projection stays unversioned.** No `Projection.schemaVersion` or other output marker; the
  output break ships as one `feat!:` release with a `BREAKING CHANGE:` section, and output
  compatibility stays a package-semver concern, as in ADR 0003.

## Considered options

- **A `rateBasis: "effective" | "nominal"` field.** Two fields that must agree, a third state when
  `nominal` has no period, and an existing Account silently keeps its meaning only by default.
  Presence of `compounding` is the discriminator with no extra state.
- **Compounding on the contract's anniversary, anchored to `Timeline.start`.** Moving the
  Projection window would move the compounding dates, so two Projections of one Account would not
  be comparable. The Baseline has no Account opening date to anchor to.
- **Interest capitalised only on a Compounding date, excluded from the reported value.** A mid-period
  row would understate what the Account is worth and what a payment would clear, and the split would
  have to be recomputed by the caller.
- **Interest-first debit allocation.** Closer to a loan statement, but it needs an accrued-payment
  accumulator so unpaid interest is not capitalised early. Deferred.
- **Daily compounding now.** Needs a zero-counted-day rule for Feb 29 and a daily walk. Deferred.
- **Pre-start accrued interest.** Deferred with the Baseline rule below.
- **A version marker on the Projection.** ADR 0003 set the precedent for unversioned output; the
  release carries the break.

## Consequences

- **Baseline round-trip hazard.** A Baseline balance is a Capitalised balance with zero Accrued
  interest at `Timeline.start`. Feeding a row's `amount` back in folds Accrued interest into the
  capitalised balance early; feeding `capitalised` drops the Accrued interest. Only a row on a
  Compounding date resumes exactly, so mid-period resumption needs a future accrued-interest Carry-in.
- A caller that opens the Projection mid-period does not invent interest before `start`: the first
  period accrues from `Timeline.start`, whose day does not earn, like the effective-annual path.
- The effective annual rate of a nominal Account is `(1 + rate/m)^m - 1` before rounding. It is not
  stored as integer basis points, so the primitive is not equivalent to pre-computing one.
- Interest is rounded at capitalisation, so a small balance may not grow at all. Documented above.
- Every parity hash changes in the ticket that changes the row type, even though effective-annual
  numbers stay identical; a one-off old-shape comparison proves the numbers did not move.
- This Spec deliberately does not keep the issue's line "existing inputs do not change": the
  Scenario version literal and the `ProjectionBalance` shape break. The effective-annual numbers
  do not, which is what the old-shape comparison proves; both breaks ship in one `feat!:` release.
- Deferred, with the next slice's shape: `daily` compounding with a Feb 29 zero-counted-day rule;
  `compoundingAnchor` for a contract anniversary, reusing the Levy `MonthDay` vocabulary;
  interest-first debit allocation; negative nominal rates with signed half-away-from-zero rounding;
  pre-start accrued-interest Carry-in; an `AnnualRollup` split of interest.
- Business-day shifting does not move compounding dates (ADR 0006 shifts money dates only).
