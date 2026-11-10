# Tax is a generic Levy computed from data, not code that knows tax

Status: accepted

The FI method scans up to ~700 candidate scenarios, and each stops earned income in a different month, so the amount owed per Settlement period must be recomputed inside every run. sim-core therefore evaluates a **Levy**: a closed rule set in the Scenario made of a period rule, a settlement rule and a graph of **Measures** built from a small fixed set of integer operations (`const`, `tally`, `add`, `sub`, `min`, `max`, `scale` with explicit rounding, `pick`). sim-core imports nothing from tax-core and has no tax vocabulary. Tax rules are authored outside the core by an emitter (in tax-core, or a glue package) that turns a jurisdiction and a taxpayer profile into Levy data.

## Considered options

- **Import tax-core behind a thin wrapper** (what we first chose). Exact per run, but sim-core's parity hash depends on tax-core's floating-point major-unit code, it carries country-specific mapping, and it cannot build until tax-core is published.
- **Neutral tax-core entry point imported by sim-core.** Removes the country mapping but keeps the dependency, the float code and the publishing block.
- **Caller-injected `taxFor()` function.** A callback, which breaks the closed-world rule.
- **Pre-computed assessments as data.** Goes stale in every FI candidate run.
- **Sampled tax curve or one-variable bracket table as data.** Cannot express the real allowance, cap and minimum-tax rules.

## Consequences

- The Levy graph schema is a public, versioned API and is hard to change; design it carefully.
- tax-core must ship an emitter beside its calculator. The two can drift, so the emitter is checked against the calculator by a golden corpus that lives in tax-core (or a glue package) and depends on sim-core's exported evaluator, never the reverse.
- Rounding is specified on every `scale` node, half away from zero for negatives.
- Rules that need more than this set (multiplying two derived values, prepayment capped at a year-to-date total, references to the previous period, several settlement dates in one period, per-person scope) are new core primitives, not extension points. The US needs several of them; ADR 0009 records which were added (`mul` and a capped Prepayment) and which were deferred.
- Because sim-core cannot know a Levy is a tax, the Projection echoes the Levy id it applied and the caller labels the result.
- Settlement periods are anchored to the Levy's own `period` month and day, not to `Timeline.start`. A start inside a period, or an earlier period whose Settlement is still on or after the start, must supply `CarryIn`; `check()` rejects a missing record instead of treating it as zero. Earlier periods then settle from that Carry-in alone.
