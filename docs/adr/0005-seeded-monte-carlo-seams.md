# Seeded Monte Carlo as data on one growth seam

Status: accepted

A projection has one future today: `valuation` turns an Account's balance into money at a date by
applying exactly one effective annual rate, `Account.rate`, through ADR-0001's integer growth rule.
A range of futures cannot be added beside that without either copying the engine per path or
teaching every rule about randomness. This ADR reserves the seams so that a deterministic run and a
sampled run differ **in input data only**: the same `processDate`, the same contribution cap, the
same Shortfall and Settlement behaviour.

## The seam

- **Returns ride in Account state, not in a parameter.** `createStates` gains an optional fourth
  argument, `runEngine` an optional fifth, and each `AccountState` carries an immutable, resolved
  Return series. `valuation(state, date)` keeps its signature and gains one branch: with no series
  it calls `grow` exactly as today; with a series it walks the Return rows crossed by
  `[asOf, date]`. Nothing downstream — `processDate`, `mutate`, `snapshot`, `withdraw`, the `upTo`
  headroom, the debt cap — can observe which branch ran.
- **This re-reads #6's wording.** #6 asked whether the step function is "a pure function of (state,
  month inputs, returns for that month)". The engine steps per Occurrence, not per month, and its
  `StateMap` is mutated in place by design, so the claim recorded here is the narrow one: the result
  of processing an Occurrence is determined by the state map (including the immutable rows on each
  Account), that date's Events and the Levy tracker. The entry point stays referentially
  transparent: same Baseline, Scenario, Timeline and Returns in, same bytes out.
- **The seam is not public.** The types live under `engine/`, never `types/`, because
  `src/index.ts` does `export type * from "./types"`; and no problem code is added, because
  `ERROR_CODES` is public and frozen. The seam therefore trusts its input, and the only caller is a
  test. Validation, with `MISALIGNED_RETURN_ROWS`, arrives with the entry point that needs it.

## Return rows

A Return row is `{ from, returnBps }`. Rows are ascending, the first `from` is `Timeline.start`,
and row *i*'s window runs from its `from` to the next row's `from`, the last to `Timeline.horizon`.
The day counts are resolved once, at run start, where the Timeline is in hand:
`D_i = countedDays(from_i, from_{i+1})` and `D_k = countedDays(from_k, horizon)`, which telescopes
to `countedDays(start, horizon)`. An inclusive `to` per row was the first design and it was wrong:
`countedDays` counts day-steps, so the step at each boundary belonged to no row, and a Feb 28 row
had zero counted days. A series is therefore tied to its horizon. A window with `D = 0` contributes
nothing.

The span return is applied over `h` held counted days of a row with `D` counted days, where
`h = countedDays(max(asOf, from), min(date, rowEnd))`:

```
roundHalfUp(amount × (10000·D + returnBps·h), 10000·D)
```

One multiplication, one division, one rounding. `h = 0` is the identity; `h = D` is the whole-row
factor; at the `-9999` bound with `h = D` the numerator is `amount × D`, so `roundHalfUp`'s
non-negative-numerator contract holds for every accepted row. Only rows with `h > 0` are walked: a
row starting after `date` would otherwise produce a negative span.

**A Return row is a span return, not an effective annual rate.** A +2% month is not 200 bps
annually, and converting needs a twelfth power and a round. Reusing annual rates per row instead
would force that conversion on every bucket and leave `money/growth`'s per-rate caches keyed by
tens of thousands of converted rates.

**A series replaces `Account.rate` for its dates.** The rate is not consulted and there is no
blending; it stays required and validated regardless. `lockedUntil` is unaffected (locked assets
still grow, they just do not count as accessible), and a Liability may carry a series.

## The departure from ADR-0001, stated

ADR-0001 rounds once per `grow` call. A series run rounds once per held row, so a many-row series
does not reproduce a single span's compounding. This is the one deliberate departure, it applies
only when a series is present, ADR-0001 carries a cross-reference to it, and the consequence is
that no equality test can compare a series run with a rate run: the only equality test is the
rate-0 case, where the factor is the identity.

A span return is bounded to `-9999..10000` bps. The bound cannot keep the arithmetic fully neutral:
because a split is linear in `r`, a row cut by a mid-row Flow gains a second-order term,
`(1 + r·h₁/D)(1 + r·h₂/D) = 1 + r + r²·h₁h₂/D²`. At realistic monthly returns that term is
negligible; it is recorded as a limit rather than fixed.

## Returns as a run input

Returns is handed to the run beside the Baseline, Scenario and Timeline:
`{ returnsVersion: 1, series }`. `Scenario.schemaVersion` stays `2` and `Baseline.schemaVersion`
stays `1`, so this is not a breaking input change, and a Scenario is never cloned per path — unlike
the survival FI scan of ADR-0004, which clones account and Levy state per candidate month — because
only Returns varies.

## Market paths

A Return model is a joint bucket table: `{ id, accounts, buckets }`, each bucket one vector of
month span returns, one per Account, with an integer weight. One bucket is one market month for
every Account at once, which is how correlation is expressed without a covariance matrix, and
which makes a historical bootstrap or a hand-written table just another bucket table. Weights are
non-negative safe integers, each at most 2^32, and their **BigInt** sum must be exactly 2^32; a
caller whose bucket count does not divide 2^32 apportions the remainder itself. The draw is
`draw32 = Number(word >> 32n)` — the high half, the best-distributed bits — and the bucket is the
smallest `i` with `draw32 < cumulative[i]`, found by binary search, so a zero weight is never drawn
and no modulo bias, rejection loop or float appears.

One draw per row serves every Account, and each Market path has its own stream, so consumption
never depends on when a path dies.

## The generator

**SplitMix64 alone**, in 64-bit wrapping BigInt: the Weyl increment `0x9E3779B97F4A7C15`, two
xorshift-multiply rounds (shifts 30, 27, 31; constants `0xBF58476D1CE4E5B9`, `0x94D049BB133111EB`),
masking with `BigInt.asUintN(64)` after the increment and after each multiply, and
`firstSplitMixOutput(s) = mix(s + gamma)`. There is no bad state: the additive increment means zero
is a fine seed. xoshiro256** was the earlier choice and is rejected here: a path needs at most about
1,200 draws, so a 256-bit state and a longer period buy nothing while doubling the specification an
oracle must mirror.

Each path's seed is `pathSeed(i) = firstSplitMixOutput(seed XOR firstSplitMixOutput(i))`. `mix` is a
bijection, so `pathSeed` is a bijection in `i` for a fixed seed and path seeds never collide; paths
are windows on one 2^64 cycle, whose chance overlap at 10,000 paths × 1,200 draws is about 1e-8 —
stated as a figure, never as "independent". The caller's seed is exactly 16 lower-case hex digits
and is echoed verbatim.

## The Outcome distribution

A stochastic run is a separate entry point and a separate type. `Projection` is the deterministic
output by definition, so the stochastic type cannot be one, and every parity hash is computed over
a Projection.

- `successBps = floor(survived × 10000 / paths)`, where a path survives when it has no Shortfall
  through the horizon — **inclusive of the horizon**, which follows from the glossary's statement
  that `start` and `horizon` are both inclusive.
- **One fixed roll-up grid from the Timeline, and every path counts in every roll-up.** Each path's
  own periods would end at its Runs-out date, so the grid cannot come from the path. A failed path
  is pinned at the net worth it died with, un-grown, in every later roll-up; a path that never
  fails contributes its closing net worth. `pathsRunning` reports the survivors but never filters
  the sample. Zero was the earlier rule and it is wrong: a plan can die owing 5M or holding a
  locked asset, and zero is a number nobody computed.
- **Percentiles are nearest-rank on integers**: `index = (level × N + 99) / 100 - 1` in integer
  division, which is `ceil(level × N / 100) - 1` without floats and always lands in `[0, N-1]` for
  `level` in `1..99`, so every reported value is one a path produced. Levels are unique integers in
  `1..99`, at most nine, default `[10, 50, 90]`. Metrics: `closingNetWorth`, `interest`,
  `unfundedContributions`. Income and expense are excluded: they are deterministic until truncation,
  and `pathsRunning` plus the histogram tell that story.
- **The Runs-out histogram is counts plus floored basis points** per date; the bps column does not
  sum to 10000 and the counts are authoritative.
- **Values are nominal.** Flow growth, inflation and Levy are unchanged, and no real percentile is
  reported.
- **One overflowing path fails the whole call** with `VALUE_OVERFLOW` at its date and Account.
  A shrunken sample, or a path silently counted as failed, would make the result's path count a lie.

## The FI method enum

ADR-0004 lands the survival method as `FinancialIndependenceOptions = SurvivalOptions`, a closed
enum with one value, and says later methods are new enum cases. This ADR fixes the shape of the
second case without changing the first: `FinancialIndependenceOptions` becomes
`SurvivalOptions | ProbabilityThresholdOptions`, discriminated by `method`, and
`FinancialIndependenceDefinition` becomes a union carrying each method's own `definitionVersion`
(today a literal `1`).

The new case carries `thresholdBps` (`1..10000`, so a 100% target is expressible), `paths`, `seed`,
and reuses `retirementSpending` and `minBufferMonths`.

A path counts at candidate month M when earned income stops at M, it has no Shortfall through the
horizon, and it meets the minimum buffer on ADR-0004's exact terms: after that date's Flows; at M
even when no Occurrence lands there; at every Occurrence after M; and at the horizon; with
`required(D) = ceil(minBufferMonths × E(D) / 12)` and `E(D)` not truncated at the horizon;
`minBufferMonths: 0` treated as omitted. ADR-0004 records a buffer breach and keeps walking so a
later Shortfall can win the binding; here a breach is simply a failed path, and the walk continues
for the same reason. That measure is an **FI survival share**, not the Outcome distribution's
success probability: one word for both would be two meanings.

The FI month is the earliest M whose survival share reaches `thresholdBps`, and every candidate
shares the same N paths by seed and index — common random numbers — or the monthly shares would not
be comparable. `FiBinding` gains `"thresholdNotReached"`, and the not-reachable result reports
`bestMonth` (highest share, ties to the earliest month) instead of ADR-0004's `bestCase`, whose
ordering ranks a single Run-out date and a single unmet amount that a distribution does not have.
Because `FinancialIndependence.reference` is required on a reachable answer and measures one
`date`'s unlocked assets and expenses, the probability case needs its own reachable variant
without it: a 25× multiple of one month says nothing about a path set. `INVALID_FI_METHOD` already
reports an unknown `method`; it landed with the survival method in #40.

The case is cost-blocked and separately capped. At ~12 ms a bare run, 720 candidates × 1,000 paths
is 720,000 runs, so its `paths` cap is 200 and it ships only with a measured budget, or after #19 or
a comparable optimisation. #19 establishes monotonicity for the deterministic predicate only.

## Caps

`paths` 1..10,000 (default 1,000); 64 Accounts per model; 512 buckets; 1,200 Return rows per series
(a hundred years of months, which also bounds the year range `Timeline` leaves open); nine
percentile levels. Rate validation follows `scalars.rate`: a non-integer rate is
`NOT_SAFE_INTEGER`, an integer outside `-9999..10000` is `RATE_OUT_OF_RANGE`. The default is the
number that answers to a budget: 1,000 paths is roughly 12 seconds of synchronous work, so the entry
point's ticket records wall-clock for 1,000 paths over a 30-year monthly horizon and drops the
default to 500 if it exceeds 60 s.

New problem codes arrive in two tiers so none is dead vocabulary: `MISALIGNED_RETURN_ROWS` with the
validator that reports it, and `INVALID_SEED`, `INVALID_PATH_COUNT`, `INVALID_PERCENTILE_LEVEL`,
`INVALID_WEIGHT`, `RETURN_WEIGHT_TOTAL`, `TOO_MANY_ENTRIES` with the entry point that uses them.

## Determinism

Same Baseline, Scenario, Timeline, Returns, model and seed produce byte-identical JSON.
`resolution` changes no stochastic number, because the entry point observes only roll-up ends and
observations never move money. A run's first *k* paths do not depend on N. Flow-array order changes
nothing. No clock, no I/O, no floats, no callbacks. The PRNG and the sampler are core primitives
behind a closed enum of one, not hooks.

## Considered options

- **A caller-injected `returnsFor(account, date)` callback.** The shortest implementation and the
  one most libraries ship. Rejected for ADR-0002's reason: a caller function cannot be validated,
  hashed or guarded by parity.
- **Floating-point returns.** Rejected by ADR-0001's existence: `Math.pow` disagreed across V8 and
  JavaScriptCore on 228 of 10,296 results.
- **Cloning a Scenario per path.** Rejected: it validates and copies a thousand Scenarios per run
  and makes a Scenario mean one market future.
- **A Scenario key for the series.** Rejected: it would break every caller with
  `schemaVersion: 3` and still express only one path per Scenario.
- **Importing a distribution library.** Rejected: a new dependency and a second numerical contract
  beside ADR-0001.
- **Percentiles per Projection row.** Rejected: at daily resolution a 60-year horizon is ~22,000
  rows, and rows × paths × levels is an output-size failure.
- **Sampling only surviving paths.** Rejected: survivorship bias, which reports a booming portfolio
  exactly when the plan has failed.
- **Zero for a failed path in later roll-ups.** Rejected after review: it fabricates a value for a
  plan that died owing money or holding locked assets.
- **SplitMix64 seeding xoshiro256\*\*.** Rejected: specification surface with no benefit at 1,200
  draws per path.
- **An inclusive `to` on a Return row.** Rejected after review: `countedDays` counts day-steps, so
  the boundary step belonged to no row and a Feb 28 row had zero counted days.

## Consequences

- Deterministic runs stay the no-series case forever; the fixtures, oracles and parity hashes are
  the guard that Monte Carlo was added beside the engine and not into it.
- A series is tied to its horizon, and its last window is shorter than a month.
- A mid-row Flow splits a row and adds the `r²` term; a per-row rounding freezes a tiny balance once
  its gain rounds to zero, at 4% annually below roughly 1,500 minor units — the effect ADR-0001
  already accepts for lazy commits.
- Series arithmetic and the PRNG are asserted under Bun only: an unexported module is not in `dist`,
  so `scripts/parity-check.mjs` cannot reach them. No cross-runtime guarantee is claimed for them
  until an entry point exists.
- The FI probability case measures a different quantity from the Outcome distribution's success
  probability, and the two must never share a field name or a glossary term.
