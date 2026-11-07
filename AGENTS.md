# AGENTS.md

Instructions for AI coding agents in `trajectonomics/sim-core` (`@trajectonomics/sim` on npm).

## Rules

1. Never commit to `main`. Branch (`feat/*`, `fix/*`, `docs/*`) and open a PR.
2. Never commit secrets or `.env` files. `NPM_TOKEN` lives in repo secrets only.
3. Pure package: no network, DOM, framework imports, or wall-clock logic. The projection as-of date is an input, never derived from `Date.now()`. `tsconfig.json` compiles `src` with no DOM, Node, or Bun types, so `fetch`/`process`/`document` fail typecheck; do not add `types` or `lib` entries to get around it.
4. Bun only: `bun install`, `bun test`, `bun run <script>`. Do not add npm/pnpm/yarn lockfiles.
5. Done means `bun run check` passes:
   - Biome lint with zero warnings.
   - File length limits: max 100 lines per source file, max 200 lines per test file (enforced by Biome).
   - Cognitive complexity: max 10 per function (enforced by Biome).
   - Strict isolatedDeclarations typecheck (`tsc -p tsconfig.json && tsc -p tsconfig.test.json`).
   - Clean package build (`tsdown`), strict packaging (`publint --strict`), and node16 type checks (`attw`).
   - Cross-runtime parity: the built package under Node hashes identically to `parity/cases.json` (recorded under Bun). After an intended numeric change run `bun run parity:update`.
   - Run `bun run format` to auto-fix formatting and imports. Do not loosen `tsconfig.base.json` or `biome.json` to make an error go away.
6. Never edit `version` in `package.json` manually and never run `npm publish` locally. Releases are handled via GitHub Actions workflows or git tags (`v*`). PR titles should follow conventional commits (`feat:`, `fix:`, `chore:`, `feat!:` ...).
7. Review against `CODING_STANDARDS.md`.

## Core Simulation Principles

1. **Closed-world simulation**: All variation comes from validated data models, never from user callbacks or plugin hooks. If a scenario cannot be represented, add a new core primitive.
2. **Determinism**: Given the same baseline, scenario, and timeline parameters, simulation output must be bit-for-bit identical across runs.
3. **Decoupled domain**: `sim-core` knows nothing about SQLite, UI, CLI, or agent concerns. Callers translate their external state into core inputs.
4. **Minor-unit safety**: All monetary arithmetic uses integer minor units (e.g. cents, satang).

## Agent skills

### Issue tracker

GitHub Issues in `trajectonomics/sim-core`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Installing and updating skills

Skills come from [`mattpocock/skills`](https://github.com/mattpocock/skills) and [`trajectonomics/internal-skills`](https://github.com/trajectonomics/internal-skills) via the Vercel [`skills`](https://github.com/vercel-labs/skills) CLI and are pinned in `skills-lock.json`. The canonical copy is `.agents/skills/` (read natively by Codex, OpenCode, Pi, and Antigravity CLI); `.claude/skills/` holds symlinks into it for Claude Code. Never edit them by hand.

- Update: `npx skills update -p -y`
- Reinstall: `npx skills add mattpocock/skills --skill '*' -a claude-code codex opencode antigravity-cli pi -y`
- Restore from the lock: `npx skills experimental_install`
