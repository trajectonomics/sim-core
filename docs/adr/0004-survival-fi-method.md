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
  Non-monotonicity is not limited to `retirementSpending` or a Levy (a `sub` or `pick` Measure can
  fall as income rises). Two more cases survive in a Scenario with neither (#19):
  - *Buffer date.* A candidate's walk checks the buffer at its own month M, so a later candidate
    gets a check that an earlier one never makes. With a Minimum buffer the pass pattern across
    candidates can be pass, fail, pass.
  - *`upTo` rounding.* A surplus step with `upTo` skips the commit on a zero fill, and ADR 0001's
    lazy per-account commits then round at different dates in different candidates, so a richer
    Scenario can end one minor unit poorer. The pattern can be pass, fail, fail, pass with no
    buffer. Both fixtures use `upTo` on a positive-rate Account.
- **Best case when unreachable.** A candidate with no Shortfall beats one with a Shortfall. Among
  Shortfalls: latest runs-out date, then smallest unmet amount, then earliest month. Among
  buffer-only failures: latest first breach date, then smallest deficit, then earliest month.
- **Binding order.** `noCandidateMonth`; then `minimumBuffer`; then `shortfallBeforeStop` when the
  runs-out date is before M; then `undrawableMoney` when locked or unrouted assets cover the
  unmet amount; otherwise `insufficientMoney`.
- **25× reference.** On a reachable answer, the result reports unlocked assets at M before M's
  flows, `E(M)`, `25 × E(M)`, and the floored multiple in basis points. It is informational and
  never decides the FI month.
  [ADR 0007](./0007-fi-reference-is-configured-not-decided.md) makes the multiplier, balances,
  window and terms configurable; the reference stays informational.
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

## The probability-threshold case

`FinancialIndependenceOptions` is a discriminated union on `method`. `probabilityThreshold` asks
the survival test of every Market path and turns the answers into an FI survival share; it does
not change the survival test. It is built on the growth seam and PRNG of ADR-0005.

- **Options.** `method: "probabilityThreshold"`, `thresholdBps` (`1..10000`, so a 100% target is
  expressible), `paths` (`1..200`) and `seed` (16 lower-case hex digits, echoed verbatim), reusing
  `retirementSpending` and `minBufferMonths`. `FinancialIndependenceDefinition` stops carrying the
  literal `1` and becomes a per-method union; each case carries its own `definitionVersion`.
- **Market input.** The Return model is a run input beside the Baseline, Scenario and Timeline,
  like the Return series of ADR-0005: `financialIndependence(..., options, model)`. It is a fifth
  argument rather than an option, because it is market data and not a decision of the method.
  `id` and `accounts` are validated, every bucket carries one `returnsBps` per Account in
  `-9999..10000`, and the weights are non-negative safe integers summing to exactly 2^32.
  `INVALID_WEIGHT`, `RETURN_WEIGHT_TOTAL` and `TOO_MANY_ENTRIES` are the ADR-0005 codes this input
  uses; 64 Accounts, 512 buckets and 1,200 month rows are its caps. A missing model is
  `MISSING_KEY` at `["model"]`. An Account the model does not name keeps its `Account.rate`.
- **Paths.** One draw per month row picks one Market bucket for every Account in the model. Path
  `i` starts from `pathSeed(seed, i)` and its rows run from `Timeline.start` to the horizon, one
  per month start; the last row's window ends at the horizon. Each path resolves its rows once and
  walks the unchanged Scenario once for its prefix, and every candidate reuses that path's prefix:
  the N paths are common random numbers across the candidate grid.
- **A path counts at candidate M** when earned income stops at M, the path has no Shortfall
  through the horizon (inclusive of a Shortfall on the horizon), and the minimum buffer holds on
  the terms above: after that date's Flows; at M even when no Occurrence lands there; at every
  Occurrence after M; and at the horizon; with `required(D) = ceil(minBufferMonths × E(D) / 12)`
  and `E(D)` not truncated at the horizon; `minBufferMonths: 0` is treated as omitted. A buffer
  breach fails the path. Every candidate is evaluated for every path separately: the share is not
  cumulative, because survival is not monotonic in M.
- **The FI month** is the earliest M whose FI survival share — `floor(survived × 10000 / paths)` —
  reaches `thresholdBps`. The floor is deliberate, so a 100% threshold needs every path.
- **Ordering and result.** An empty candidate grid is `noCandidateMonth`. Otherwise, when no month
  reaches the threshold, `FiBinding` reports `"thresholdNotReached"` and the result carries
  `bestMonth { month, fiSurvivalBps }` — highest share, ties to the earliest month — instead of
  `bestCase`, whose ordering ranks a single Run-out date and a single unmet amount that a
  distribution does not have. A reachable answer carries `fiSurvivalBps` and drops `reference`: a
  25× multiple of one month says nothing about a path set. The definition echoes the model id
  beside the seed and the path count.
- **Validation** sits at `["options", ...]` like the survival case. `thresholdBps` follows
  `scalars.rate`: a non-integer is `NOT_SAFE_INTEGER`, an integer outside `1..10000` is
  `RATE_OUT_OF_RANGE`. `paths` outside `1..200` is `INVALID_PATH_COUNT` and a malformed `seed` is
  `INVALID_SEED`; both arrive with the case, per ADR-0005's two-tier rule. An unknown `method`
  stays `INVALID_FI_METHOD`, which already exists.
- **Overflow.** A prefix or candidate walk that overflows fails the whole call with
  `VALUE_OVERFLOW` at its date and Account: a share over a shrunken sample would be a lie.
- **Cost gate.** #19 landed, so the gate is met. The 200-path cap stays the method's own: the
  Outcome distribution's is 10,000, and the two never share an option type.

## Considered options

- **Binary search over months.** Assumes survival is monotonic in M. Retirement spending can make
  it non-monotonic, so v1 scans linearly. Still rejected after #19: the buffer-date and `upTo`
  cases above break monotonicity without a Levy or `retirementSpending`, and a linear verification
  fallback saves nothing because proving that every earlier month fails costs as much as the scan.
  The scan is made cheaper by exact constant-factor work, never by a different search order.
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
