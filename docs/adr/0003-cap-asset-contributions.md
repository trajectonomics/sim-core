# Asset contributions capped at Available cashflow

Status: accepted

A Contribution into an asset account is a **target**, not an obligation: it may only spend the
Available cashflow of the same Occurrence, and the part it cannot fund is dropped and reported.
A Contribution into a liability remains a debt payment and an obligation, so it can still cause a
Shortfall. This makes saving unable to pull money out of existing assets or turn accessible money
into locked money.

- **Liability first.** On each Occurrence, same-date Contribution amounts are summed per Account.
  Every liability is then paid `min(planned, owed)`, in account-id order.
- **One shared budget.** `available = max(0, income - expense - sum(paid))`. Asset targets draw
  from that budget in `cashflow.contribute` order: `applied = min(planned, remaining)`, and
  `unfunded = planned - applied`. The remaining budget is reduced by each grant.
- **Dropped, not carried.** An unfunded amount never moves to another date. A zero grant never
  touches the account, so an asset Contribution cannot cause a withdrawal or a Shortfall.
- **Reported.** `AnnualRollup.unfundedContributions` sums the dropped amount per period and
  `Projection.unfundedContributions` totals it per account through the runs-out date, non-zero and
  sorted by account id.
  `AnnualRollup.contributions` continues to mean applied contributions, debt plus asset.
- **New required input.** `Scenario.cashflow.contribute` lists asset accounts in funding-priority
  order. Every asset target must appear; extra accounts are inert. `check()` reports
  `CONTRIBUTION_UNROUTED` at the flow's `target` for a missing asset target, even outside the
  timeline. Liability targets are not routed.
- **Schema split.** `Scenario.schemaVersion` becomes `2`; `Baseline.schemaVersion` stays `1`.
  The shared constant becomes `BASELINE_SCHEMA_VERSION` and `SCENARIO_SCHEMA_VERSION`.
- **Per-Occurrence limitation.** The cap only sees the current Occurrence. Income saved on one
  date can still be spent by an expense on another date, which may then withdraw from assets.
  There is deliberately no monthly window, netting across dates, or carry-over.

## Considered options

- **Leave contributions uncapped.** Savings could be funded from existing assets, silently
  defeating the purpose of the target and making Shortfalls depend on the order of unrelated
  flows.
- **Cap only under an FI method.** Hides the rule from ordinary projections and lets the same
  Scenario mean different things in different calls.
- **Carry unfunded amounts forward.** Needs a budget ledger, makes the result depend on how long
  the projection ran, and has no natural expiry.
- **A monthly budget window.** Aligns better with pay cycles but adds a second time model next to
  Occurrences and makes date alignment inside the month semantic.
- **Pro-rata allocation.** Avoids priority but gives every target a partial fill; a priority list
  is simpler to explain and to test.
- **Allocate in account-id order.** Deterministic but arbitrary; callers cannot express which
  goal matters first.

## Consequences

- The input is breaking: Scenario version 2, a required `contribute` list, and the new output
  fields. This is why the change ships as `feat!:`.
- Asset-to-asset moves are impossible; a caller needs an income or expense Flow to model them.
- Results depend on date alignment between income, expense and Contribution Flows. The cap is
  evaluated per Occurrence, not per month.
- Voluntary extra debt principal stays an obligation; it is not capped by Available cashflow.
  Modelling a payment that is only made when affordable needs a separate primitive.
