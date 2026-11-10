# sim-core

Pure, deterministic personal-finance projection engine.

## Overview

`sim-core` models personal-finance projection as it works in the real world:
- **Pure and deterministic**: Given a baseline financial state and an event scenario, it produces a projection timeline. The as-of date is an input; there is no unseeded randomness and no internal wall clock.
- **Closed-world**: No callbacks or external plugin hooks; all behavior emerges from validated, structured data.
- **Strict environment**: Built with strict TypeScript with zero DOM, Node, or Bun ambient types in the core engine.

## Input schema

A Scenario is version `4`. `check()` reports `UNSUPPORTED_SCHEMA_VERSION` at
`scenario.schemaVersion` for anything else, so an older Scenario is rejected before its fields
are read. v3 added nominal compounding; v4 replaced `levy` with `levies` and `prepaymentBps`
with `prepayments`, renamed `Projection.levy` to `Projection.levies`, and added `steps` on a
`const` Measure and `derive` on a Flow. An Account may declare a `compounding` period
(`monthly`, `quarterly`, `semiannual` or `annual`) to make its `rate` nominal; without it,
`rate` is the effective annual rate. See [ADR 0007](docs/adr/0007-nominal-compounding.md).

## Levies

A Levy is a closed rule set: a twelve-month period rule, a settlement rule and a graph of
Measures over the Flows' Tally labels. A Scenario may hold several in `scenario.levies`; each
has its own periods, Settlement and Carry-in, and they share Tally labels but never read each
other. A Flow's Prepayment credits one Levy per entry, and the shares are rounded cumulatively
in Scenario Levy order so together they never exceed the gross:

```ts
{ id: "salary", kind: "income", earned: true, amount: 1_000_000, frequency: "monthly",
  start: "2026-01-31", growth: { bps: 0 }, label: "salary",
  prepayments: [{ levy: "national", bps: 300 }, { levy: "local", bps: 200 }] }
```

A `const` Measure may step on given dates. A Settlement period reads the last step on or before
its own last day, not its Settlement date, so a fact that holds at the end of a period governs
that period and a step between the two does not reopen it:

```ts
{ id: "due", op: "const", value: 100_000,
  steps: [{ from: "2026-06-01", value: 200_000 }, { from: "2027-01-01", value: 300_000 }] }
```

A Flow takes `derive` instead of `amount` and `growth`: a Measure graph whose `flow` op reads
another Flow's planned gross amount on the same Landed date, before Prepayment and any cap, and
0 when that Flow does not land then. Rent as 30% of salary follows a raise:

```ts
{ id: "rent", kind: "expense", frequency: "monthly", start: "2026-01-31",
  derive: { measures: [
    { id: "salary", op: "flow", flow: "salary" },
    { id: "result", op: "scale", of: "salary", num: 30, den: 100, rounding: "halfUp" },
  ], result: "result" } }
```

A negative derived amount or one that overflows is reported, never clamped. In the Financial
Independence test earned income stops, so a derived amount that reads it falls to 0; a derived
expense that reads earned income is rejected by the FI entry unless `retirementSpending`
replaces every expense after the FI month. The plain Projection is unaffected. See
[ADR 0008](docs/adr/0008-levy-extensions.md).

## Scripts

- `bun run check`: Complete verification suite (`lint`, `typecheck`, `test`, `build`, `lint:package`).
- `bun run build`: Build ESM and CJS bundles via `tsdown`.
- `bun test`: Run test suite.
- `bun run typecheck`: Run strict TypeScript compiler checks.
- `bun run lint`: Lint with Biome (zero warnings allowed).
- `bun run format`: Auto-format and organize imports with Biome.
- `bun run lint:package`: Validate package manifests and type exports with `publint` and `@arethetypeswrong/cli`.

## License

MIT

## Releasing

Versions are computed, never edited by hand (`package.json` says `0.0.0-development` on purpose). The shared publish workflow (`trajectonomics/cicd`) reads the last `vX.Y.Z` git tag and the conventional commit messages since then:

| Commits since last release | Bump |
| --- | --- |
| any `feat!:` / `fix!:` / `BREAKING CHANGE:` | major (minor while on 0.x) |
| any `feat:` | minor |
| anything else | patch |

- **Alpha, automatic:** Every merge to `main` that touches code publishes `<next>-alpha.<n>` under the npm dist-tag `alpha` (`bun add @trajectonomics/sim@alpha`). `n` counts up per upcoming version.
- **Stable, on demand:** Actions → Release → Run workflow (on `main`). It publishes `<next>` under `latest`, tags `vX.Y.Z`, and creates a GitHub release with generated notes. The bump input overrides the computed one; pick `major` to cut 1.0.0.

PR titles must be conventional commits (enforced by the `PR title` check) because squash-merge commit subjects become the basis for version calculation.
