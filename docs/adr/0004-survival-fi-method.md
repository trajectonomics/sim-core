# Survival FI method

Status: accepted

Financial Independence (FI) is the earliest month in which **earned** income can stop and the
Projection still has no Shortfall through the horizon. The method is a closed enum: `survival` is
the only value now, and later methods (25× rule, probability threshold, part-time income, target
net worth) are new enum cases, never plugins. `definitionVersion` is `1` and changes whenever the
test's behaviour changes.

- **Candidate grid.** First-of-month dates from the first month start at or after `Timeline.start`
  through `Timeline.horizon`, inclusive. A mid-month start begins at the next month start; a
  horizon in that same month gives an empty grid and `binding: "noCandidateMonth"`. `M =
  horizon` is a valid candidate.
- **Stop mechanics.** Earned-income occurrences on or after M are removed; passive income and
  contributions continue. With `retirementSpending`, planned expenses from M are replaced by one
  expense on the first of each month from M through the horizon. No Scenario is rewritten or
  re-validated.
- **Expense-rate window.** `E(D)` measures post-stop expenses in the full twelve months
  `[D, D + 12 months)`, even past the horizon. Measurement events never move money.
  `required(D) = ceil(minBufferMonths × E(D) / 12)` in exact integer arithmetic.
- **Growth basis.** Retirement spending is nominal at `Timeline.start`, not at M. Each occurrence
  grows by the engine's whole-year rule with `growthYears(Timeline.start, date)`, so a later M
  never makes retirement cheaper in real terms.
- **Buffer checks.** After M's flows, at every Occurrence after M, and at the horizon, accessible
  net worth must be at least `required(D)`. A breach is recorded but does not stop the walk, so a
  later Shortfall can win the binding.
- **No monotonicity assumption.** `retirementSpending` can remove a large expense only for an
  early M, so a later candidate may fail where an earlier one passed. The scan is ascending and
  returns the first pass; it never binary-searches. A Shortfall before M is identical for every
  later candidate, so the scan may stop there.
- **Best case when unreachable.** A candidate with no Shortfall beats one with a Shortfall. Among
  Shortfalls: latest runs-out date, then smallest unmet amount, then earliest month. Among
  buffer-only failures: latest first breach date, then smallest deficit, then earliest month.
- **Binding order.** `noCandidateMonth`; then `minimumBuffer`; then `shortfallBeforeStop` when the
  runs-out date is before M; then `undrawableMoney` when locked or unrouted assets cover the
  unmet amount; otherwise `insufficientMoney`.
- **25× reference.** On a reachable answer, the result reports unlocked assets at M before M's
  flows, `E(M)`, `25 × E(M)`, and the floored multiple in basis points. It is informational and
  never decides the FI month.
- **Execution.** The scan reuses the unchanged prefix: one walk saves cloned account states and
  Levy tallies before each candidate month, then each candidate continues from its own clone.
  This keeps Levy tallies and Settlements recomputed for the modified part without building a
  full Projection per candidate. Settlement dates are part of the survival walk; no Levy amount is
  cached between candidates.
- **Levy report.** An older issue comment asked for unsettled Levy periods in the result, but the
  agreed `FinancialIndependence` result type has no Levy field. This version follows the result
  type and returns no Levy report.
- **Overflow.** A prefix overflow that no earlier candidate avoids is returned as `ok: false` with
  `VALUE_OVERFLOW`; candidates up to the stop date are still scanned first, so an earlier passing
  month can win. A candidate walk overflow does not stop the scan, but an unsafe 25× reference on
  the earliest passing month is terminal: that month cannot be reported, and a later month must
  not silently replace it.
- **Last supported year.** The measurement window is not truncated by the horizon, but dates stop
  at `9998-12-31`, the last year the core accepts. Near that edge the window can be shorter than
  twelve months rather than leave the supported calendar.

## The probability-threshold case (reserved, unbuilt)

`FinancialIndependenceOptions` is a discriminated union on `method`. `survival` is the only value
built today; `probabilityThreshold` is the reserved second case, specified in full in ADR-0005 and
delivered by #67. It does not change the survival test: it asks that test of every Market path and
turns the answers into a share.

- **Options.** `method: "probabilityThreshold"`, `thresholdBps` (`1..10000`, so a 100% target is
  expressible), `paths` (`1..200`) and `seed` (16 lower-case hex digits, echoed verbatim), reusing
  `retirementSpending` and `minBufferMonths`. `FinancialIndependenceDefinition` stops carrying the
  literal `1` and becomes a per-method union.
- **A path counts at candidate M** when earned income stops at M, the path has no Shortfall
  through the horizon (inclusive of a Shortfall on the horizon), and the minimum buffer holds on
  the terms above: after that date's Flows; at M even when no Occurrence lands there; at every
  Occurrence after M; and at the horizon; with `required(D) = ceil(minBufferMonths × E(D) / 12)`
  and `E(D)` not truncated at the horizon; `minBufferMonths: 0` is treated as omitted. A buffer
  breach fails the path and the walk continues, so a later Shortfall can win the binding exactly
  as in the survival method.
- **The FI month** is the earliest M whose FI survival share — survived paths divided by `paths` —
  reaches `thresholdBps`. Every candidate shares the same N paths by seed and index: common random
  numbers, or the monthly shares would not be comparable. The scan stays ascending rather than
  binary, because the survival method's monotonicity is not assumed.
- **Ordering and result.** The binding order above applies. When the candidate grid is non-empty
  and no month reaches the threshold, `FiBinding` reports `"thresholdNotReached"` and the result
  carries `bestMonth { month, fiSurvivalBps }` — highest share, ties to the earliest month —
  instead of `bestCase`, whose ordering ranks a single Run-out date and a single unmet amount that
  a distribution does not have. Because `FinancialIndependence.reference` measures one date's
  unlocked assets and expenses, the probability case's reachable variant drops it: a 25× multiple
  of one month says nothing about a path set.
- **Validation** sits at `["options", ...]` like the survival case. `thresholdBps` follows
  `scalars.rate`: a non-integer is `NOT_SAFE_INTEGER`, an integer outside `1..10000` is
  `RATE_OUT_OF_RANGE`. `paths` outside `1..200` is `INVALID_PATH_COUNT` and a malformed `seed` is
  `INVALID_SEED`; both arrive with the case, per ADR-0005's two-tier rule. An unknown `method`
  stays `INVALID_FI_METHOD`, which already exists.
- **Cost gate.** At roughly 12 ms a bare run, 720 candidates × 200 paths is 144,000 runs, so the
  case ships only after #19 or a comparable optimisation, or with a measured budget recorded
  against the 60 s bar. The 200-path cap is the method's own: the Outcome distribution's is 10,000,
  and the two never share an option type.

## Considered options

- **Binary search over months.** Assumes survival is monotonic in M. Retirement spending can make
  it non-monotonic, so v1 scans linearly.
- **Call `project()` per candidate.** Correct but builds rows, roll-ups and reports for every
  candidate. The survival walk only keeps the state, tallies and buffer measurements it needs.
- **Fixed-amount buffer.** The agreed definition is months of expenses; a fixed amount needs a
  separate primitive.
- **Report the 25× figure as the answer.** It is a rule of thumb, not the agreed survival test.
  It is reported beside the answer, clearly labelled.

## Consequences

- `FinancialIndependenceOptions` is validated separately, with problems at `["options", ...]`.
- Invalid input and overflow remain data (`ok: false`), never exceptions.
- Day and month resolutions produce the same FI answer; only `project()` rows differ.
- **With a Calendar**, the stop mechanics and the retirement expense dates are Landed dates:
  earned-income occurrences are removed by the date they land on, and the monthly retirement
  expense moves to its next Business day like any other Due date.
