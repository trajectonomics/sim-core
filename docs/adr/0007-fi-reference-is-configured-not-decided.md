# The FI reference is configured as options on survival and never decides

Status: accepted

ADR 0004 reports a 25× rule-of-thumb figure beside a reachable FI month. It is fixed: multiplier 25,
unlocked asset Accounts only, the next twelve months of expenses, nominal money. Callers who want
30×, a net-worth numerator or real money must recompute it. Issue #20 makes it configurable without
making it the answer.

## Decision

- **An optional `reference` block on `SurvivalOptions`**, with four closed fields: `multiplier`
  (integer 1..100, default 25), `basis` (`unlockedAssets` default, `allAssets`, `accessibleNetWorth`,
  `netWorth`), `window` (`next12Months` default, `trailing12Months`) and `terms` (`nominal` default,
  `real`). Not a separate helper, which cannot see the walked state at the FI month, and not a new
  method value, because the reference is not an FI test. `ProbabilityThresholdOptions` (ADR 0005)
  does not carry it.
- **The answer never depends on it.** `month`, `binding` and `bestCase` are identical for every
  block. `definition` does not echo the block and `definitionVersion` stays `1`. The one exception
  is ADR 0004's terminal `VALUE_OVERFLOW` on the earliest passing month.
- **Valued at the FI month before that month's flows.** `liabilities` are subtracted only by the net
  worth bases, with the glossary's Net worth and Accessible net worth meanings.
- **`trailing12Months`** sums original-plan expenses (ignoring `retirementSpending`) in
  `[M - 12 months, M)` clipped to Timeline.start; `partial` is true when a window is shorter than
  twelve months. `annualExpenses` is the raw sum, never annualised.
- **`real`** reports every amount in Timeline.start money, deflating each Account value and each
  expense occurrence individually; `met` and the multiple come from the reported amounts and can
  differ from nominal by more than rounding.
- **`multipleBps`** is `floor(numerator × 10000 / annualExpenses)` with floor toward negative
  infinity, so it can be negative; it is omitted at zero expenses and `met` is then `numerator >= 0`.
- **Output shape is not configurable.** The result always carries numerator, denominator,
  `threshold`, `multipleBps` and `met`.
- **Breaking rename.** `label` is `"ruleOfThumb"`, the type is `RuleOfThumbReference`, and
  `TwentyFiveTimesReference` stays as a deprecated alias. The package is 0.x and no repository in
  the organisation reads the old name.

## Considered options

- **A new `rule-of-25` method value.** The reference is not a test of FI; ADR 0004 reserves method
  values for tests.
- **An annual roll-up window.** Roll-ups run between anniversaries of `start`, not around the FI
  month, and need a Projection per candidate.
- **Keeping `ruleOfThumb25x` when the multiplier is 25.** Leaves a label that depends on a setting.
- **Two booleans instead of `basis`.** Four values map to the glossary's terms without ambiguity.

## Consequences

- New problem codes: `REFERENCE_MULTIPLIER_OUT_OF_RANGE`, `INVALID_REFERENCE_BASIS`,
  `INVALID_REFERENCE_WINDOW`, `INVALID_REFERENCE_TERMS`.
- Default options give the same numbers as before; the result type and parity cases change.
