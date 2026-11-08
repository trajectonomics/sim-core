# Coding standards

Judgement calls for review. Mechanical rules live in `biome.json`, the tsconfigs and `bun run check`, not here.

- **Glossary vocabulary.** Identifiers and test names use the terms in `GLOSSARY.md`. A term listed under `_Avoid_` (Event, Stream, Period, Run, Tick, ...) does not name a type, function or file.
- **Hand-computed expectations.** A test's expected value comes from a hand calculation, the oracle, or a recorded fixture. Re-applying the formula under test to produce the expected value cannot fail, so it is not a test.
- **Independent oracle.** Code under `src/golden/oracle-*` imports nothing from `calendar/`, `money/`, `engine/` or `output/`, and prefers naive arithmetic (exact rationals, day-by-day walks) over mirroring the engine's design.
- **One worked number per identity.** Each stated identity (conservation, rounding, day count) has a test with a concrete number, including the tie, leap-day and shortfall cases.
- **Errors as data.** For input that `check()` accepts, `project()` returns a result and never throws. Calendar arithmetic stays inside the supported years or saturates.
- **Intended numeric change.** A change to any projected number updates the ADR or glossary when the decision changes, runs `bun run parity:update`, and says so in the PR description.
