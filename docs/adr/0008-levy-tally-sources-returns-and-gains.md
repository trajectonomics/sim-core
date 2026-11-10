# Levy tally sources: Account returns and realised gains

Status: accepted

A Levy tallied only Flows (ADR 0002). Taxing what an Account earns, or the gain on selling it, needs two more tally sources. They cannot be fed in as Flows by the caller: the FI scan (ADR 0004) re-runs the whole Projection for each candidate stop month, and each candidate withdraws from investments on different dates, so the amounts must be computed inside every run.

## Decision

- **Two new bases on the existing `tally` Measure.** `TALLY_BASES` gains `returns` and `gains`. The Measure vocabulary of ADR 0002 does not grow. `Carry-in` accepts both bases, and for these two a Carry-in amount may be negative. `Tallies` stays public with the two new maps optional.
- **`returns` is accrued growth.** It totals the growth an asset Account accrued inside a Settlement period, under the Account's `returnLabel`. It is signed. The core has one rate per Account and cannot tell interest, dividends and price growth apart, so a Levy that taxes only realised sales uses `gains` instead.
- **`gains` is realised.** It totals the gain realised by withdrawals from an asset Account, under its `gainLabel`, in the Settlement period containing the withdrawal's Landed date. It is signed.
- **Sheltering is the absence of a label.** A tax-sheltered, locked Account carries no label and is never tallied (the Tally-label rule). There is no shelter flag. Labels exist on assets only, need a Levy, and one Account may not carry both: growth taxed as a return and then taxed again as a gain on sale would be double counting, because growth never adds basis.
- **Attribution reads, never writes.** Each labelled Account keeps a ledger: its value right after its last commit and the growth already attributed since. The growth not yet attributed at a read point is `valuation(x) − that value − attributed`, so every piece is a difference of valuations from one base: the pieces sum exactly to the interval's growth and, at a non-negative rate, none is negative. A period's boundary is its last day; day-steps ending on or before it belong to the period. A commit attributes the rest to the period it falls in; a Settlement and the run's end close the open period without committing. ADR 0001's lazy commits are untouched, so no balance changes.
- **Pooled cost basis, in the core.** A gain-tracked Account has one cost basis (average cost). Applied Contributions and surplus fills add to it; growth does not. A withdrawal takes `basis × withdrawn / valueBeforeWithdrawal`, rounded half up and capped at the remaining basis; the gain is `withdrawn − basis taken`. Basis belongs in the core for ADR 0002's reason: the FI scan changes withdrawal dates per candidate, so the caller cannot precompute realised gains.
- **Opening basis is Baseline state.** It is an optional `basis` on a Baseline balance entry. Optional additive keys keep `Baseline.schemaVersion` 1 and `Scenario.schemaVersion` 2 (ADR 0005). `check()` requires it for a gain-tracked Account with a positive opening balance, as it requires Carry-in rather than treating a gap as zero. A `basis` on an Account without `gainLabel` is ignored, and a `gainLabel` on an Account outside `cashflow.withdraw` never realises a gain; both are documented, not errors, so one Baseline or Scenario family can serve several variants.
- **No circularity to solve.** A Settlement falls strictly after the period it closes, so a period's returns and gains are final before its Settlement, and whatever the Settlement withdraws realises in a later period. No fixed point is needed.

## Considered options

- **Realised-only or accrual-only for returns.** Accrual fits interest, realisation fits sales, and one rate per Account can express only the first; `gains` covers the second.
- **New Measure operations for returns and gains.** Rejected: the closed operation set already reads totals by label and basis.
- **A shelter flag on Account.** Rejected: an absent label already means never tallied.
- **Lot-level cost basis with holding periods.** Needed for short- versus long-term gains. Deferred until an emitter needs it (#28); the pooled basis is the seam.
- **Opening basis as a Scenario key beside Carry-in.** Rejected: it is state at `start`, like a balance.
- **Clamping negative returns or gains at zero in the core.** Rejected: loss offsetting is jurisdiction knowledge a Levy expresses with `max` and `sub`.
- **Re-compounding each period's growth from the previous read.** Rejected: single-span rounding then drifts by a minor unit between reads.

## Consequences

- A Scenario with no `returnLabel` or `gainLabel` keeps every number and parity hash.
- Withholding at source on returns or gains, tax-loss carry-forward, and interest on liabilities are not modelled.
- tax-core's emitter must write the labels and the Baseline `basis`; the two can drift, so the golden corpus of ADR 0002 gains cases for both bases.
- Short- versus long-term needs a new primitive and its own ADR.
