# Validation Report — local-cloudflare-dev-env

- Gate: 5 — Test
- Base commit: 3bde311
- Date: 2026-11-07
- Result: 9 of 9 checks pass

## 1. Passed

| # | Check | Result |
| - | ----- | ------ |
| 1 | `make check ARGS=--all` | `PASS`, exit 0 (format, lint, types, unit, worker, wrangler types) |
| 2 | `make doctor` | 8 `ok`, 1 `warn` (port 5173 is in use), `PASS`, exit 0 |
| 3 | `make verify-local` | Server on `127.0.0.1:5199`. 10 checks `ok` (server, 4 worker routes, D1 + R2, queue, workflow, R2 copy, Local Explorer). `PASS`, exit 0, 4.2 s |
| 4 | `make e2e` | 2 of 2 Playwright tests pass on port 5199 |
| 5 | `pnpm run test:unit` | 5 files, 66 tests pass |
| 6 | `pnpm run test:worker` | 1 file, 7 tests pass |
| 7 | `.dev.vars` recipe (Makefile line, temp directory, two runs) | First run creates the file. Second run keeps `MARKER=keep` |
| 8 | Remote-op `grep` (`deploy`, `--remote`, `--env`) in new scripts | No match |
| 9 | `gitleaks detect --no-git --source scripts` and a pattern `grep` on the diff | No leaks found |

After `make verify-local`, no listener stays on port 5199. No `vite` or `workerd` process of stack-cloudflare stays alive.
No request went to port 5173.

## 2. Failed + remediation

None.

## 3. Not run + reason

- Live `VERIFY_PORT=5173 make verify-local` and the live SIGINT abort: the auto mode permission classifier denied these commands in this session. Unit tests cover the same rules (`findFreePort`, `isPortFree`, `startServer` process-group stop and SIGKILL). Gate 4 recorded live evidence: port 5174 selected, SIGINT exit 130, no orphans.
- Full `make setup`: not run again, because it runs `pnpm install` and `playwright install`. Gate 4 ran it two times. This gate tests the `.dev.vars` recipe line on its own (check 7).
- ub-quality: `not-run`. `@vitest/coverage-v8` is not installed, and the run forbids new dependencies. `dryer` does not read `.mjs`. `crapper` reports a maximum cyclomatic complexity of 6, so CRAP stays below 10 at full coverage.

## 4. Static checks

- Format (`prettier --check`), lint, typecheck, `wrangler types --check`: pass (in `make check ARGS=--all`).
- Secret scan: `gitleaks` reports no leaks.
- Dependency scan: no dependency change, so no new advisory surface.
- ub-quality: crap n/a (max CC 6), real-dup n/a, survived n/a, uncovered-unjustified 0. Status `not-run` (no coverage provider).

## 5. Residual risk

- Impact 2: unchanged. The change is local developer tooling.
- Likelihood 2: unchanged. Coverage is strong and green, but no line coverage number exists.
- Risk score: **4** (tolerance 9).
- Open items: `reuseExistingServer: true` in `playwright.config.ts` (follow-up). Add `@vitest/coverage-v8` in a separate change.

## 6. Traceability

| Requirement (Gherkin) | Implementation | Tests | Evidence |
| --------------------- | -------------- | ----- | -------- |
| Prerequisites are present | `scripts/doctor.mjs`, `make doctor` | `evaluateDoctor` healthy | Check 2 |
| A prerequisite is missing | `doctor.mjs` `gatherFacts` | Doctor CLI without `node_modules` | Check 5 |
| Every local primitive works | `scripts/verify-local.mjs`, `make verify-local` | `primitiveChecks`, `runAll`, `startServer` | Checks 3, 5 |
| The preferred port is busy | `scripts/lib/local-dev.mjs` `findFreePort`, `viteArgs` | `findFreePort`, `isPortFree`, `waitHealthy` | Checks 2, 3, 5 |
| First-time setup | `make setup` | `.dev.vars` recipe test, `chromiumState` | Checks 5, 7 |
| `make verify` unchanged (R6) | `scripts/verify.mjs` `smokeChecks` | `verify.test.ts` | Checks 3, 5 |

## 7. Jev review items

Both verdicts are `review`. They do not block the gate.

- Artifact, "claims a result without evidence" (P=0.56): each result in §1 names the command and its real output. The logs are from this session.
- Tests, "tests depend on private implementation details" (P=0.35): the tests import exported helpers and assert on printed lines or process state. The CLI tests spawn the real scripts.

### jev-result
```
rubric: 5-test
verdict: review
items: pass 5  uncertain 1  fail 0
failed: [none]
artifact: .sdlc/runs/local-cloudflare-dev-env/jev-5-test.md
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
gate: 5-test
status: passed
risk-score: 4
impact: 2  likelihood: 2
checks: 9/9 passing
hard-stop-triggers: [none]
jev: review (artifact) · review (tests)
ub-quality: not-run (@vitest/coverage-v8 not installed; new dependency forbidden; dryer does not read .mjs; max CC 6)
artifacts: .sdlc/runs/local-cloudflare-dev-env/05-test-plan.md, .sdlc/runs/local-cloudflare-dev-env/05-validation-report.md
note: check --all, doctor, verify-local (5199, 4.2s, 10 ok), e2e 2/2, unit 66, worker 7 pass; live 5173/SIGINT reruns denied by classifier, covered by unit tests.
```
