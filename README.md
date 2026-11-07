# sim-core

Pure, deterministic personal-finance projection engine.

## Overview

`sim-core` models personal-finance projection as it works in the real world:
- **Pure and deterministic**: Given a baseline financial state and an event scenario, it produces a projection timeline. The as-of date is an input; there is no unseeded randomness and no internal wall clock.
- **Closed-world**: No callbacks or external plugin hooks; all behavior emerges from validated, structured data.
- **Strict environment**: Built with strict TypeScript with zero DOM, Node, or Bun ambient types in the core engine.

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

Versions are computed, never edited by hand (`package.json` says `0.0.0-development` on purpose). `scripts/version.ts` reads the last `vX.Y.Z` git tag and the conventional commit messages since then:

| Commits since last release | Bump |
| --- | --- |
| any `feat!:` / `fix!:` / `BREAKING CHANGE:` | major (minor while on 0.x) |
| any `feat:` | minor |
| anything else | patch |

- **Alpha, automatic:** Every merge to `main` that touches code publishes `<next>-alpha.<n>` under the npm dist-tag `alpha` (`bun add @trajectonomics/sim@alpha`). `n` counts up per upcoming version.
- **Stable, on demand:** Actions → Release → Run workflow (on `main`). It publishes `<next>` under `latest`, tags `vX.Y.Z`, and creates a GitHub release with generated notes. The bump input overrides the computed one; pick `major` to cut 1.0.0.

PR titles must be conventional commits (enforced by the `PR title` check) because squash-merge commit subjects become the basis for version calculation.

Preview the next version locally:

```bash
bun scripts/version.ts --channel alpha
bun scripts/version.ts --channel stable
```
