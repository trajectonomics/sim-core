# Several Levies, dated constants and derived Flow amounts

Status: accepted

ADR 0002 gave a Scenario one Levy, fixed constants and Flows with fixed amounts, and deferred three extensions (#29). All three stay inside the closed-world rule: data only, no callbacks.

## Decision

- **Several Levies.** `Scenario.levy` becomes `levies`, a non-empty array with unique ids. Each Levy has its own period and settlement rule, Measures and Carry-in. A Tally label is a global name that every Levy tallies over its own periods. A Flow's `prepaymentBps` becomes `prepayments`, `{ levy, bps }` entries (one per Levy, sum at most 10000, income Flows only). The shares are rounded cumulatively in Scenario Levy order, because rounding each half up alone can take more than the gross (1 minor unit at 5000 + 5000 bps would take 2). Settlements on one Landed date are summed into the one signed movement the order of operations already nets, so Levy order cannot change cash. `Projection.levy` becomes `levies`, in Scenario order; row and Annual roll-up `levy` are sums. This is a breaking input change, moving `Scenario.schemaVersion` to 4 after nominal compounding (ADR 0007) moves it to 3.
- **Dated constants.** A `const` takes `steps` (`{ from, value }`, strictly ascending, exclusive with `asOf`/`growth`) and uses the last step on or before the period's last day. The Settlement date is later and must not reopen a closed period. `const` growth still measures to the Due date of the Settlement (ADR 0006). `LevyContext` gains an optional `periodEnd` that falls back to `date`, because tax-core builds the context.
- **Derived Flow amounts.** A Flow carries `amount` or `derive`, a Measure graph with a new `flow` op naming another Flow by id; `derive` has no `tally` and a Levy has no `flow`. `flow` reads the planned gross amount that Flow lands on the same Landed date, before Prepayment and any cap, never a funded amount (it depends on this Occurrence's cashflow). It is 0 when the Flow does not land that date, so a caller aligns dates. Flows are evaluated in dependency order; `check()` rejects unknown ids and cycles. A negative result is `NEGATIVE_AMOUNT` and an overflow `VALUE_OVERFLOW`, never a clamp, so a wrong graph is noticed. A derived Flow takes no `growth`.
- **FI.** Candidates filter earned income out, so a Derived amount that reads it falls to 0 afterwards: right for a derived income or contribution, optimistic for a derived expense, because rent as 30% of salary would vanish at retirement and FI would come out too early. The FI entry therefore rejects a derived expense that reads earned income, transitively, unless `retirementSpending` replaces every expense after the FI month. The plain Projection is unaffected. The rejection can later become a rule without an input change.

## Considered options

- **An additive `levies` beside `levy`.** Two sources of truth and a permanent exclusivity rule.
- **One `prepaymentBps` plus a `prepaymentLevy`.** Cannot split a Flow's Prepayment across Levies.
- **Reading a step at the Settlement date.** A step between a period's end and its Settlement would change a closed period.
- **Label-based Flow references.** A label needs a Levy and means a tally; a Flow id is exact and works without a Levy.
- **Clamping a negative derived amount to 0.** Hides a wrong graph.
- **Silent 0 for a derived expense in FI candidates.** Returns a too-early FI month.

## Consequences

- The rules that need a new primitive stay in #28 (multiplying two Measures, Prepayment capped at a year-to-date total, previous-period references, per-person scope, several Settlement dates in one Levy) and #27 (account returns and capital gains as tally sources).
- A Levy reading another Levy's result, and a Flow reading a Levy's due amount, are not supported.
- Derived amounts are same-Occurrence only; a Flow due on another date contributes 0.
