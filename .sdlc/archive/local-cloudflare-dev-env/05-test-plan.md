# Test Plan — local-cloudflare-dev-env

- Gate: 5 — Test
- Inputs: `contract.md`, `state.md`, `02-design-note.md`, `03-risk-register.md`, `04-implementation-plan.md`
- Base commit: 3bde311
- Date: 2026-11-07

## 1. Strategy

The change adds local developer tooling only: `make doctor`, `make setup`, and `make verify-local`.
The tests prove the contract scenarios through two layers:

1. Unit tests (`vitest --project unit`) test the pure rules and the helpers. They also spawn the real CLI scripts for the failure paths.
2. Real runs of the `make` targets prove the full path against the real `workerd` runtime. No mocks are used (AGENTS.md rule 4).

Not worth a test: the Markdown docs and `package.json` script aliases. `make check ARGS=--all` covers the format of these files.

## 2. Unit

| File | Scope |
| ---- | ----- |
| `tests/unit/scripts/local-dev.test.ts` | `formatResult`, `summarize`, `parseMajor`, `findFreePort`, `isPortFree` (real `node:net` listener), `pollUntil` (fake clock), `createTail` |
| `tests/unit/scripts/doctor.test.ts` | `evaluateDoctor` for each check and severity; `chromiumState`; CLI without `node_modules` |
| `tests/unit/scripts/verify-local.test.ts` | `viteArgs`, `waitHealthy`, `primitiveChecks`, `runAll`, `startServer` (process group, SIGKILL path), CLI without `node_modules` |
| `tests/unit/scripts/verify.test.ts` | `verify.mjs` CLI output pins (PASS, health FAIL, no server) |

## 3. Integration

- `make verify-local` starts the real Vite and `workerd` server. It tests D1, R2, the Queue consumer, the Workflow, and the Local Explorer.
- `make doctor` runs on the real machine.
- `vitest --project worker` runs the existing Worker tests (regression).

## 4. Contract

- The `ok` / `warn` / `FAIL … Fix:` line format and the `PASS` / `FAIL N failing checks` summary are pinned in `local-dev.test.ts`.
- The `verify.mjs` CLI output is pinned in `verify.test.ts` (R6).
- The Worker HTTP API is unchanged. The smoke checks inside `verify-local` call the public API only (DR-2).

## 5. E2E

- `make e2e` runs the existing Playwright tests on port 5199. The tests do not use port 5173.

## 6. Regression

- `make check ARGS=--all`: format, lint, types, unit, worker, wrangler types.
- `make e2e`: existing user flows.
- `verify.test.ts`: the `make verify` CLI behavior stays the same after the refactor.

## 7. Negative and abuse

| Case | Test |
| ---- | ---- |
| `node_modules` is missing | `doctor.test.ts` CLI test; `verify-local.test.ts` CLI test (FAIL, names `make build`, exit 1) |
| Old Node.js, wrong or missing pnpm | `evaluateDoctor` tests |
| Chromium or `.dev.vars` is missing | `evaluateDoctor` tests (fix `make setup`) |
| No free port in the range | `findFreePort` none; `evaluateDoctor` verify-port FAIL |
| Port is busy (foreign listener) | `isPortFree` with a real listener; `evaluateDoctor` 5173 warn |
| Dev server exits early or never becomes healthy | `waitHealthy` exited, timeout, unreachable |
| Queue or Workflow timeout, rejected artifact, body mismatch, POST 500, explorer 404, fetch error | `primitiveChecks` tests |
| Child process ignores SIGTERM | `startServer` SIGKILL test |
| Existing `.dev.vars` | The Makefile recipe runs two times in a temp directory. The marker line stays. |
| Remote Cloudflare operation | `grep` for `deploy`, `--remote`, `--env` in new scripts |
| Secret in the diff | `gitleaks detect` on `scripts/`; pattern `grep` on the diff |

## 8. Performance, accessibility, security

- Performance: `make verify-local` must finish in less than the 60 s timeout. Measured: 4.2 s.
- Accessibility: not relevant (no UI change).
- Security: the scripts bind and fetch `127.0.0.1` only. Gate 6 does the full review.

## 9. Test data

- Local D1 rows and R2 objects with the title `verify-local-<timestamp>` in `.wrangler/` (R9).
- `tests/unit/scripts/fake-worker.ts`: a real `node:http` server for the `verify.mjs` pins.
- A temp `.dev.vars.example` and `.dev.vars` in the scratchpad for the recipe test.

## 10. Traceability

| Test | Gherkin scenario | Risk |
| ---- | ---------------- | ---- |
| `make doctor` (PASS); `evaluateDoctor` healthy | Prerequisites are present | R11 |
| Doctor CLI without `node_modules` | A prerequisite is missing | R11 |
| `make verify-local` (PASS); `primitiveChecks`; `runAll` | Every local primitive works | R4 |
| `startServer` process-group tests; no orphan after `make verify-local` | Every local primitive works (server stops) | R1, R12 |
| `findFreePort`, `isPortFree`, `viteArgs`, `waitHealthy` | The preferred port is busy | R2, R3 |
| `.dev.vars` recipe test | First-time setup | R7 |
| `verify.test.ts` pins | — (regression) | R6 |
| Remote-op `grep` | — | R8 |
| `chromiumState` tests | First-time setup | R5, R10 |
