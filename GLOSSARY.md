# Simulation Core Glossary

Domain vocabulary for `sim-core` (personal-finance projection engine).

**Design rule:** a primitive is defined by how the simulation treats it, not by its real-world name. Things that behave the same are the same primitive.

## Core Concepts

**Baseline**:
The opening snapshot: balances per account at the Timeline start. Nothing else.
_Avoid_: Initial state, starting ledger, opening balance

**Scenario**:
The complete, self-contained set of rules and plan applied to a Baseline: currency, economy, accounts, flows, and cashflow routing. Not a diff; callers build variants by editing a copy.
_Avoid_: What-if model, fork, experiment

**Timeline**:
The run parameters `{ start, horizon, resolution }`. `start` is the date the Baseline balances are measured at. `resolution` (`day` or `month`) only selects which rows the Projection reports; it never changes the numbers.
_Avoid_: Date list, time steps

**Projection**:
The deterministic output of a Baseline, Scenario and Timeline: states and cashflows over the horizon.
_Avoid_: Forecast, prediction, simulation run

**Occurrence**:
A date on which at least one Flow lands or a Settlement falls. Only Occurrences change balances; the Timeline's `start` and `horizon` are both inclusive.
_Avoid_: Tick, step, period

**Annual roll-up**:
Totals over one twelve-month period of a Projection, running from an anniversary of `start` to the day before the next one. The last period is cut short by the horizon or a Shortfall and marked partial.
_Avoid_: Year, fiscal year

**Levy**:
A closed rule set in the Scenario that charges an amount for each Settlement period from that period's Flows: a period rule, a settlement rule and a graph of Measures. The core does not know what a Levy represents; callers, or a rule-set emitter such as tax-core, author it as data.
_Avoid_: Tax, tax rules, formula callback, plugin

**Settlement period**:
A twelve-month period set by the Levy's period rule, over which the Levy tallies Flows before it settles. Usually a calendar year. A Settlement period and an Annual roll-up rarely cover the same days, and Levy results are reported per Settlement period with `settled` and `partial` flags.
_Avoid_: Tax year, fiscal year, year, Annual roll-up

**Measure**:
A named value inside a Levy, computed in integer minor units from tallies, constants and other Measures. The Measures form an acyclic graph, and the Levy names the Measure that is due.
_Avoid_: Variable, formula, derived flow

**Tally label**:
A label on an income Flow, or on a contribution Flow, that a Levy sums over a Settlement period. A Flow with no label is never tallied. Gross tallies use the planned income amount; funded tallies use the amount a contribution actually applied after any cap.
_Avoid_: Category, tag, tax category

**Prepayment**:
An amount taken at source from an income Flow, as a share in basis points of each Occurrence's gross amount, rounded half up in minor units. Only the net lands in cash. The period's total is credited against the Levy at Settlement.
_Avoid_: Withholding, prepaid tax

**Settlement**:
The one date after a Settlement period ends on which the Levy's due amount is reconciled against Prepayment. A balance due is paid like an expense and a refund lands like income. The date comes from the Levy's settlement rule. A period the Projection ends before is still reported, with `settled: false`, and nothing is deducted.
_Avoid_: Tax settlement, filing, payment

**Carry-in**:
The tallies and Prepayment already recorded for a Settlement period that began before `start`, supplied by the caller because the Baseline holds balances only. It covers the period containing `start` and any earlier period whose Settlement falls after `start`.
_Avoid_: Year-to-date, opening income

**Account**:
A named balance with an explicit rule in the Scenario: `kind` (`asset` or `liability`), effective annual rate in basis points (one year grows the balance by exactly the rate), optional `lockedUntil`. Every account with a balance must have a rule. A liability's balance is the positive amount owed.
_Avoid_: Wallet, holding

**Flow**:
A dated cash movement of kind `income`, `expense` or `contribution`, with a frequency (including `once`), a start, an optional end, and growth. Replaces the former Stream and Event.
_Avoid_: Stream, Event, Transaction, Recurring transaction, Schedule

**Contribution**:
A Flow that moves money from cashflow into an Account. Not an expense: net worth is unchanged at that instant. Into a liability account it is a debt payment and an obligation. Into an asset account it is a target: it is limited to the Available cashflow on that Occurrence and is never funded from existing assets. Same-date amounts are summed per Account, and `cashflow.contribute` sets the funding priority.

**Available cashflow**:
The income on one Occurrence minus its expenses and debt payments actually made, floored at zero. Other dates are ignored; this is the ceiling for asset contributions.
_Avoid_: Free cashflow, disposable income

**Unfunded contribution**:
The part of an asset contribution's planned amount, after same-date summing per Account, that Available cashflow could not cover. It is dropped, not carried over. Debt planned above the amount owed is not unfunded.
_Avoid_: Missed contribution

**Earned income**:
Income from work, marked `earned: true`. It is the only income that stops in the FI test.
_Avoid_: Active income, salary income

**Passive income**:
Income marked `earned: false`. It continues when earned income stops.
_Avoid_: Investment income, unearned income

**Cashflow**:
The routing rules for net money each time flows land: ordered `surplus` steps (account, optional fixed `upTo`), an ordered `contribute` list of asset accounts (funding priority), and an ordered `withdraw` list.
_Avoid_: Income/expense delta

**Shortfall**:
Money owed on an Occurrence that no unlocked Account in the `withdraw` list can supply. Expenses and debt payments are never refused; asset contributions are capped before this point. A debt payment can cause one; an asset contribution cannot. The Projection ends on that date.
_Avoid_: Overdraft, deficit

**Runs-out date**:
The date of the first Shortfall, recorded with the unmet amount. Absent when money lasts to the horizon.
_Avoid_: Depletion date, bankruptcy

**Net worth / Accessible net worth**:
Net worth is every Account's value with liabilities subtracted, including locked assets. Accessible net worth does the same but leaves out assets before their `lockedUntil`; it is not the same as the subset the `withdraw` list can draw on.
_Avoid_: Liquid assets, spendable

**Financial Independence (FI)**:
The earliest month in which earned income can stop and the Projection has no Shortfall through the horizon. The FI method fixes the exact test and any extra condition, such as a minimum buffer.
_Avoid_: Retirement, target date

**Financial Independence month**:
The first day of the earliest month at which the FI test passes. It is a date; age is a caller concern.
_Avoid_: FI date, retirement date

**Retirement spending**:
The monthly spending that replaces planned expenses from the FI month onward when the FI method is given an override.
_Avoid_: Post-retirement expenses, withdrawal rate

**Minimum buffer**:
The number of months of expenses the FI method requires as accessible net worth.
_Avoid_: Emergency fund, cash reserve

## Input Conventions

- All dates are `YYYY-MM-DD`, in years 0001-9998. There are no ages in the core; callers convert ages to dates.
- All money is integer minor units in one currency per Scenario; callers convert before calling.
- All rates are integer basis points.
- Collections are arrays of objects with unique `id`s, never objects keyed by id.
- Inputs are checked by a hand-written `check()` returning `{ code, path }[]`; unknown keys are rejected.
