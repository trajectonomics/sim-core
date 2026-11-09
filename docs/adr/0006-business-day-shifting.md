# Business-day shifting is Scenario data, and only money dates move

Status: accepted

Flow Due dates and Levy Settlement dates are exact calendar dates, so a Projection puts a bill on a Saturday. Real money moves on Business days. A caller can fake it only by editing dates (wrong again next year) or by shifting in its own code, after which its ledger and the Projection disagree by a day, and the `check()` it ran saw a different Scenario than it displays.

## Decision

- The Scenario carries an optional **Calendar**: a closed `dayRule` (`exact` or `next`) and an explicit list of Holidays. Absent or `exact` means today's behaviour. Shifting is data, never a callback, because a holiday set is jurisdiction knowledge the core must not hold (ADR 0002).
- A Due date that is not a Business day moves forward one day at a time until it is. That is the **Landed date**, and it is the Occurrence date. Nothing moves backwards: forward-only keeps a Settlement after the period it closes and keeps Settlement dates strictly increasing.
- Recurrence stays anchored on the Flow's own start with the existing month-end clamp, and `end` caps Due dates, so a Landed date may fall after `end`. Only Landed dates are compared with the Timeline.
- Growth stays anchored on the Due date: a Flow's anniversaries count from its start, and a Levy `const` is measured to the Settlement's Due date. Shifting changes when money moves, never how much a Flow is worth.
- **Outcomes do follow the Landed date**, because every routing rule is per-Occurrence: Available cashflow, funded versus Unfunded contributions, surplus, withdrawals, the Runs-out date, and the Annual roll-up and Settlement period a Flow counts in. A weekend that splits an income from a contribution can therefore change whether that contribution is funded.
- A Holiday list that leaves a run of 366 or more consecutive non-business days is rejected (`HOLIDAYS_UNUSABLE`), because a period may not settle a whole year late.
- The Projection is unchanged: `SettlementPeriod.settlementDate` reports the Landed date, and a caller that wants the Due date recomputes it from the Scenario it authored.

## Considered options

- **A caller-supplied `isBusinessDay` callback.** Breaks the closed-world rule and makes parity depend on caller code.
- **Weekend days as data.** A Friday/Saturday weekend is a new validated shape; fixed Saturday and Sunday covers every consumer so far, and a `weekend` key is additive later.
- **Backwards and nearest shifting.** Payroll sometimes runs early, but a Settlement inside the period it closes would be evaluated before that day's income is tallied. Deferred as another enum value.
- **Yearly-recurring Holiday entries.** Fixed dates cannot express observed substitutes or lunar holidays, so a dated list is required anyway; the caller expands its own recurring rules.
- **Per-Flow Calendars.** A household has one calendar; per-Flow rules multiply validation and let a caller express two inconsistent ones.
- **Shipping holiday data, or reading it from tax-core.** That is the jurisdiction knowledge this core refuses to hold.

## Consequences

- `Scenario.schemaVersion` stays 2: the section is optional, and an older core rejects it with `UNKNOWN_KEY`.
- The business-day test is integer weekday arithmetic on the calendar day number plus set membership, so Node and Bun agree bit for bit and no clock or locale is involved.
- The glossary gains Calendar, Business day, Holiday, Due date and Landed date; Scenario, Occurrence, Settlement and Carry-in are amended.
- The survival FI scan cuts by Landed date, so a Flow due 31 January and landing 2 February is stopped from the February candidate.
