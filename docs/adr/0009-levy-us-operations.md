# Levy operations for US-style rules: a derived product and a capped Prepayment

Status: accepted

ADR 0002 fixed eight Measure operations and a Prepayment that is a flat share of every income Occurrence, and named five rules the US needs as new primitives (#28). tax-core's US calculator (`src/us/stages/*`) settles two of them: credits and deductions whose size is a derived amount times a derived factor, and a payroll tax that should stop being prepaid once wages pass a wage base. The other three are already expressible, belong to #29, or have no consumer.

## Decision

- **`mul`.** `a * b / den` in exact BigInt arithmetic with explicit `rounding` (`floor`, `halfUp`, `ceil`, ties away from zero), mirroring `scale`. `a` and `b` are Measure ids and `den` is an integer of at least 1. `check()` treats both operands as graph edges (`UNKNOWN_MEASURE`, `MEASURE_CYCLE`) and rejects a missing operand, `den` below 1 and an unknown rounding with a code and a path. Only the final quotient is range-checked: a value that is not a safe integer is `VALUE_OVERFLOW` at the date, never a throw, and an intermediate product above 2^53 whose quotient is safe still evaluates.
- **Capped Prepayment.** An income Flow may carry `cappedPrepayment: { bps, upTo }` beside `prepaymentBps`. `upTo` names a Levy `const` Measure. `check()` requires an income Flow, a Levy, a `label`, an existing `const` (`CAP_NOT_CONST` otherwise) whose value is not negative, and the two shares together at most 10000 basis points. The capped share applies to the part of each Occurrence's gross below the cap on the label's period-to-date gross: Carry-in gross, earlier dates and earlier same-date events, in the engine's order (Flow `id`, then Due date). Each share rounds half up on its own base. (v4, [ADR 0008](./0008-levy-extensions.md): the uncapped share is now a `prepayments` entry, and the cap names its Levy with `levy`, because a Scenario may hold several.)
- **One cap value per period.** The `upTo` const is evaluated once per Settlement period when the tracker is created, in the same context as the other Measures (the Settlement's Due date), so Prepayment and `due` use one number. The tracker stores the exact value; a value that is not a safe integer is reported as `VALUE_OVERFLOW` at the Occurrence that reads it, so a period the Projection never reaches does not report it. Prepayment is computed against the tracker inside the per-date step, never hoisted, so the FI prefix clone followed by candidates equals a full run.
- **Per-person scope needs no primitive.** A Tally label is the unit of scope: one label, one `const` cap and one Measure per earner, summed with `add`. GLOSSARY.md says so and a golden case proves it.
- **Deferred.** A reference to the previous Settlement period waits for a consumer: tax-core's US calculator has no carryforward, safe-harbor or estimated-tax logic. Two Settlement dates inside one Levy are not added; #29's several Levies give federal and state their own period, settlement and `due`, which resolves the use case, and whether Prepayment would then need a Levy selector is decided there.
- **No schema version bump.** Both additions only widen what `check()` accepts, so every existing Scenario keeps its meaning and numbers (precedent ADR 0006).

## Considered options

- **A generic expression or callback for derived products.** Breaks the closed-world rule; ADR 0002 requires a fixed operation set.
- **Expressing a product by nesting two `scale` ops.** Needs a second operand shape for no gain; `mul` mirrors `scale` so emitters learn one pattern.
- **A cap on the whole period instead of period-to-date gross.** Prepayment would need the period's final gross before it is known; a year-to-date running total is what payroll withholds against.
- **A separate `cappedPrepaymentLevy` selector.** One Levy needs none; #29 adds one if several need it.
- **A Prepayment floor beside the cap (Additional Medicare above $200,000).** Not modelled by any consumer yet; `cappedPrepayment` can gain one later.
- **Capping in the caller.** The FI scan re-runs the whole Projection per candidate and the caller cannot know the candidate's period-to-date gross (ADR 0002's reason).
- **Per-person primitives.** Separate labels, caps and `add` already express joint filing with separate caps; a new scope primitive would duplicate the Tally label.

## Consequences

- The Levy vocabulary grows by one op (`mul`) and income Flows grow by one optional field. Emitters need a package version that has them.
- tax-core's US emitter can express the care credit, AOTC, South Carolina's linear phase-out and Social Security's wage base; Medicare stays the uncapped `prepaymentBps` on the same Flow.
- A cap is a `const`, so an indexed wage base is a growing `const`; growth is measured to the Settlement's Due date, one step later than the calendar year it covers, and the emitter picks `asOf`.
- The cap reads the label's period-to-date gross, so a caller who starts mid-period must supply the label's Carry-in gross and prepaid amount, as for every other tally.
- Several Settlement dates, previous-period references and Prepayment floors remain open on #28.
