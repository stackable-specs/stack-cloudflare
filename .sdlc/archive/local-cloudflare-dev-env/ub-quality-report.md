# ub-mode Quality Report — local-cloudflare-dev-env

- Base commit: 3bde311
- Status: **not-run** (coverage provider is not installed)

## Scope

Package root: `/Users/owenzanzal/pai/src/stack-cloudflare`.

Changed source files: `scripts/doctor.mjs`, `scripts/lib/local-dev.mjs`, `scripts/verify-local.mjs`, `scripts/verify.mjs`.

Out of scope: tests (`tests/unit/scripts/*.test.ts`, `tests/unit/scripts/fake-worker.ts`), `Makefile`, JSON config, Markdown.

## Results

| Tool | Result | Reason |
| ---- | ------ | ------ |
| crapper | Complexity only. Max CC = 6 (`verify-local.main`). Coverage = 0% for all functions. | `@vitest/coverage-v8` is not a project dependency. crapper tried `npm install --no-save @vitest/coverage-v8@4.1.12`. npm failed in this pnpm project (`Cannot read properties of null (reading 'matches')`). The run forbids new dependencies. |
| dryer | not run | dryer reports "No source files to analyze" for `.mjs` files. |
| mutator | not run | Every site reports UNCOVERED, because the same coverage provider is missing. Results are not meaningful. |

CRAP with full coverage equals CC. The highest CC is 6, so no function can reach CRAP >= 10 at full coverage. At 0% coverage, 14 functions are >= 10; these are tool artifacts, not measured values.

## Blocking failures

None measured.

## Debt

None in touched files.

## Uncovered by unit tests (with reason)

- `verify-local.mjs` `main()` after the `node_modules` check: process orchestration (`pnpm run db:migrate:local`, Vite spawn, signal handlers). `make verify-local` exercises it against the real `workerd` (PASS, also with `VERIFY_PORT=5173` and with SIGINT).
- `doctor.mjs` CLI block on a healthy machine: `make doctor` and `make setup` exercise it (PASS).

## Tool notes

- Commands: `crapper scripts/doctor.mjs scripts/lib/local-dev.mjs scripts/verify-local.mjs scripts/verify.mjs`; `dryer --threshold 0.8 <files>`; `mutator scripts/lib/local-dev.mjs`.
- Versions: crapper 6fd92c4, dryer 66ff6d2, mutator a5a0cb8.
- Cleanup: `.metrics/` removed (not git-ignored). No `target/`.
- Follow-up: add `@vitest/coverage-v8` (pinned to the vitest version) in a separate dependency change, then run this gate again.

### sdlc-result
```
gate: ub-quality
status: not-run
scope: 4 changed files in 1 package (base 3bde311)
crap: n/a (no coverage provider; max CC 6)
dryer: n/a (.mjs not supported)
mutator: n/a (no coverage provider)
debt: 0
artifact: .sdlc/runs/local-cloudflare-dev-env/ub-quality-report.md
note: @vitest/coverage-v8 missing; adding it is a new dependency, which this run forbids.
```
