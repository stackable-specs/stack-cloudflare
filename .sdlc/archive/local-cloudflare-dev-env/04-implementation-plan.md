# Implementation Plan — local-cloudflare-dev-env

- Gate: 4 — Implementation
- Inputs: `contract.md`, `state.md`, `02-design-note.md` (Option A, DR-1, DR-2), `03-risk-register.md` (R1–R12)
- Base commit: 3bde311
- Date: 2026-11-07
- Status: all steps done

## Slices

| Slice | Theme | Hard gate / exit criterion |
| ----- | ----- | -------------------------- |
| 1 | Shared helpers: result lines, port probe, poll, output tail | `pnpm exec vitest run --project unit tests/unit/scripts/local-dev.test.ts` green and `pnpm run typecheck` clean |
| 2 | `doctor` + `make doctor` / `make setup` | `doctor.test.ts` green; `make setup` prints `PASS`; a second `make setup` keeps `.dev.vars` content |
| 3 | `verify.mjs` refactor (pinned) + `verify-local` + `make verify-local` | `verify.test.ts` green before and after the refactor; `verify-local.test.ts` green; `make verify-local` prints `PASS` |
| 4 | Surface: `package.json` scripts, README, AGENTS.md, format config | `make check ARGS=--all` prints `PASS` |

## Steps

| Step | Slice | Purpose | Files/modules | Behavior change | Tests | Risk | Validation | Done |
| ---- | ----- | ------- | ------------- | --------------- | ----- | ---- | ---------- | ---- |
| 1.1 | 1 | Deterministic `ok` / `warn` / `FAIL … Fix:` lines and `PASS` / `FAIL N failing checks` summary | `scripts/lib/local-dev.mjs` | New module | `local-dev.test.ts` (formatResult, summarize) — contract output format | — | unit green | yes |
| 1.2 | 1 | Free-port probe on `127.0.0.1` and `::1`; range search `VERIFY_PORT`..+20 | `scripts/lib/local-dev.mjs` | New | `isPortFree` with a real `node:net` listener; `findFreePort` first/last/none | R2, R3 | unit green | yes |
| 1.3 | 1 | `pollUntil` with timeout and last value; `createTail` (last 200 lines) | `scripts/lib/local-dev.mjs` | New | fake clock; chunk-split lines | R4 | unit green | yes |
| 1.4 | 1 | Let unit tests import `.mjs` with types | `tsconfig.node.json` (`allowJs`, include `scripts`) | Typecheck now reads `scripts/` (no `checkJs`) | `pnpm run typecheck` | — | clean | yes |
| 2.1 | 2 | Prerequisite rules as a pure function of facts | `scripts/doctor.mjs` `evaluateDoctor` | New | one test per check and severity (node, pnpm none/10/12, deps, types, chromium missing/no-deps, `.dev.vars`, D1 warn, 5173 warn, verify port) | R11 | unit green | yes |
| 2.2 | 2 | Gather facts; resolve Chromium from the project `@playwright/test` only when `node_modules` exists | `scripts/doctor.mjs` `gatherFacts`, `chromiumState` | New | temp dir without `node_modules`; `VERIFY_PORT`; CLI prints `FAIL`, names `make build`, exit 1 | R5, R11 | unit green; `make doctor` | yes |
| 2.3 | 2 | `make doctor`, `make setup` | `Makefile` | Additive targets; `.dev.vars` copied only when missing | manual: `make setup` twice with a marker line | R7, R10 | PASS; marker kept | yes |
| 3.1 | 3 | Pin `verify.mjs` CLI output before refactor | `tests/unit/scripts/verify.test.ts`, `fake-worker.ts` | None | exact output PASS; health FAIL; no server → 4 failing | R6 | green on old code | yes |
| 3.2 | 3 | Export `smokeChecks(base)`; CLI unchanged | `scripts/verify.mjs` | None for CLI | same pin tests | R6 | green after refactor | yes |
| 3.3 | 3 | Process-group server start/stop (SIGTERM, SIGKILL after grace), output tail | `scripts/verify-local.mjs` `startServer` | New | grandchild process dies after `stop()`; early exit is not alive; SIGTERM-ignoring child is killed | R1, R12 | unit green; no orphan after `make verify-local` and after SIGINT | yes |
| 3.4 | 3 | Identity: own child alive + health `ok` | `waitHealthy` | New | ok; exited; degraded timeout; unreachable | R2, R3 | unit green | yes |
| 3.5 | 3 | Primitive checks through the public API (DR-2) with skip-on-dependency | `primitiveChecks`, `runAll` | New | published path; rejected; queue timeout; workflow timeout; body mismatch; POST 500; explorer 404; fetch error; smoke FAIL | R4 | unit green | yes |
| 3.6 | 3 | CLI: port select, local migrate, spawn `vite --strictPort --host 127.0.0.1`, signal cleanup, report with output tail on FAIL | `main`, `Makefile` `verify-local` | New target | CLI without `node_modules` → FAIL + `make build` | R1, R2, R3, R8 | `make verify-local` PASS (port 5199, 4.3 s); `VERIFY_PORT=5173` → 5174; SIGINT → exit 130, no orphans | yes |
| 4.1 | 4 | `pnpm run doctor`, `pnpm run verify:local` | `package.json` | Scripts only; no dependency change | — | — | `make check` | yes |
| 4.2 | 4 | Document targets, port rules, timeout, local state | `README.md`, `AGENTS.md` | Docs | — | R9 | prettier | yes |
| 4.3 | 4 | Keep run artifacts out of the format check | `.prettierignore` (`.sdlc/`) | `prettier --check` skips `.sdlc/` | — | — | `make check ARGS=--all` PASS | yes |

## Verification results

- `pnpm exec vitest run --project unit`: 5 files, 66 tests, all pass.
- `make check ARGS=--all`: `PASS`.
- `make verify-local`: 10 checks `ok`, `PASS`, exit 0. No `vite` or `workerd` process stays after the run.
- `VERIFY_PORT=5173 make verify-local`: selects `127.0.0.1:5174`. No request goes to the `kubectl` port-forward.
- SIGINT at 2.5 s: exit 130, port 5199 free, no orphan process.
- `make setup` (twice): doctor `PASS` (one warn for port 5173); the existing `.dev.vars` line stays.

## Deviations from the design

- The `exit` / SIGINT path sends SIGKILL to the process group at once. An `exit` handler cannot wait 5 s for SIGTERM. The normal stop path uses SIGTERM, then SIGKILL after 5 s.
- `chromiumState` uses `createRequire` from the project root. A dynamic `import()` of the CommonJS entry does not expose `chromium` as a named export.
- `tsconfig.node.json` gets `allowJs` and includes `scripts/`, so typed unit tests can import the `.mjs` modules. `checkJs` stays off.
- `.prettierignore` gets `.sdlc/`. Without it, `make check` fails on the run artifacts.

## Escalation points

None. No step needs a blocked action: no deploy, no `--remote`, no `--env staging`, no secret, no schema or binding change, no new dependency, no public API change. `grep -nE "deploy|--remote|--env" scripts/doctor.mjs scripts/verify-local.mjs scripts/lib/local-dev.mjs` finds no command (gate 6 confirms).

## ub-quality

`not-run` — `@vitest/coverage-v8` is not installed, and adding it is a new dependency. `dryer` does not read `.mjs`. Highest cyclomatic complexity is 6, so CRAP stays below 10 at full coverage. Report: `ub-quality-report.md`.

## Risk reassessment

- Impact 2: unchanged. Local developer tooling only.
- Likelihood 2: unchanged. Process cleanup (R1) and port selection (R2, R3) were proven on this machine.
- Risk score: **4** (tolerance 9).

## Out of scope

- `reuseExistingServer: false` in `playwright.config.ts` (follow-up from gate 3).
- Add `@vitest/coverage-v8` and run the ub-quality gate with coverage (follow-up).
- `docs/specs/platform/cloudflare-local-development.md` edit (optional in the design; not done).
- Pre-existing debt: none found in touched files.

## Jev review items

Both verdicts are `review`. They do not block the gate.

- Artifact, "each step names its tests" (P=0.54): steps 4.1–4.3 are docs and config. `make check ARGS=--all` is their test.
- Tests, "tests depend on private implementation details" (P=0.34): the tests import exported helpers (`evaluateDoctor`, `primitiveChecks`, `startServer`) and assert on the printed lines or process state. The CLI tests spawn the real scripts.
- Note: the first `tests` run judged an empty diff, because the new test files were untracked. `git add -N` (intent-to-add, no commit) made them visible to `git diff`. The second run is the result below.

### jev-result
```
rubric: 4-implementation
verdict: review
items: pass 5  uncertain 1  fail 0
failed: [none]
artifact: .sdlc/runs/local-cloudflare-dev-env/jev-4-implementation.md
```

### jev-result
```
rubric: tests
verdict: review
items: pass 4  uncertain 1  fail 0
failed: [none]
artifact: .sdlc/runs/local-cloudflare-dev-env/jev-tests.md
```

### sdlc-result
```
gate: 4-implementation
status: passed
risk-score: 4
impact: 2  likelihood: 2
hard-stop-triggers: [none]
jev: review (artifact) · review (tests)
files-changed: [Makefile, package.json, tsconfig.node.json, .prettierignore, README.md, AGENTS.md, scripts/verify.mjs, scripts/doctor.mjs, scripts/verify-local.mjs, scripts/lib/local-dev.mjs, tests/unit/scripts/local-dev.test.ts, tests/unit/scripts/doctor.test.ts, tests/unit/scripts/verify.test.ts, tests/unit/scripts/verify-local.test.ts, tests/unit/scripts/fake-worker.ts]
ub-quality: not-run (@vitest/coverage-v8 not installed; adding it is a forbidden new dependency; dryer does not read .mjs)
artifact: .sdlc/runs/local-cloudflare-dev-env/04-implementation-plan.md
note: make setup/doctor/verify-local added; verify-local PASS on 127.0.0.1:5199 (skips busy 5173), no orphans after SIGINT; make check --all PASS.
```
