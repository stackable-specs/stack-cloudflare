# Security & Privacy Review — local-cloudflare-dev-env

- Gate: 6 — Security
- Base commit: 3bde311 (uncommitted diff)
- Date: 2026-11-07
- Change class: Infrastructure / deploy (local tooling only). This is not an auth or security change.
- Tool report: [06-secops-report.md](06-secops-report.md)

## Scope

`scripts/doctor.mjs`, `scripts/verify-local.mjs`, `scripts/lib/local-dev.mjs`, `scripts/verify.mjs`, the `setup`, `doctor`, and `verify-local` Makefile targets, `package.json` scripts, and the new unit tests.

## Findings

| # | Area | Finding | Severity | Mitigation | Status |
|---|------|---------|----------|------------|--------|
| F0 | Authentication & authorization | The diff adds no auth logic and changes no route. The Worker API has no authentication by design (template). The scripts use no Cloudflare credentials or API token: `wrangler d1 migrations apply --local` and `vite` need no login. The dev server binds only to loopback, so no remote user can reach it. Least privilege holds: the scripts run as the developer and need no elevated rights. | Info | None needed. | Closed |
| F1 | Command injection | `spawn` and `spawnSync` use fixed argument arrays and no shell. The only input is the port number. | Info | None needed. | Closed |
| F2 | Input validation | `VERIFY_PORT` was not validated. A value above 65535 made `net.listen` throw, and the script crashed without a PASS or FAIL line. | Low | Added a check: `VERIFY_PORT` must be an integer from 1024 to 65515. The script prints `FAIL select port` and exits 1. | Fixed |
| F3 | Process control | `startServer` had no `error` listener. A spawn failure (for example ENOENT for `pnpm`) can emit `error` without `exit`. This crashed the script and could hang `stop()`. | Low | `exited` now resolves on `exit` or `error`. | Fixed |
| F4 | Process control | The script kills the dev server by process group (`detached: true`, `process.kill(-pid)`). SIGINT and SIGTERM exit 130. The `exit` handler sends SIGKILL to the group. Errors from a gone group are caught. The script does not kill a process that it did not start. | Info | None needed. Gate 5 confirmed that no listener or child stays alive. | Closed |
| F5 | Network exposure | Vite starts with `--host 127.0.0.1 --strictPort`. `isPortFree` requires both `127.0.0.1` and `::1` to be free. All requests go to `http://127.0.0.1:<own port>`. | Info | None needed. | Closed |
| F6 | Foreign port | A race between the port check and the Vite bind can let another process take the port. `--strictPort` makes Vite exit, and `waitHealthy` reads `server.alive()` before each request. A small window stays before the exit is seen. The script sends only GET `/api/health` in that window. | Low | Accepted. Local machine only. Port 5173 is never a target of `verify-local`. | Accepted |
| F7 | Foreign port | `scripts/verify.mjs` still defaults `BASE_URL` to `http://localhost:5173`. This is the `kubectl` port-forward port. The default is pre-existing and unchanged. `verify-local` does not use it. | Low | Follow-up: set `BASE_URL` explicitly, or remove the default. | Follow-up |
| F8 | Secrets | `.dev.vars` and `.dev.vars.*` are git-ignored (`.gitignore` line 12). Only `.dev.vars.example` is tracked, and it has no values. `make setup` uses `test -f .dev.vars \|\| cp`, so it never overwrites the file. gitleaks (dir and git history) and semgrep `p/secrets` found nothing. | Info | None needed. | Closed |
| F9 | Unsafe logging | On FAIL, `verify-local` prints the last 200 lines of dev server output. Wrangler lists `.dev.vars` names and hides values. The probe data is synthetic. | Low | Accepted. Output goes only to the local terminal. | Accepted |
| F10 | Remote operations | The new scripts call only `db:migrate:local` (`--local`) and `vite`. No `deploy`, `--remote`, or `--env staging`. `wrangler.jsonc` is unchanged. No remote binding is set. | Info | None needed. | Closed |
| F11 | Dependencies | osv-scanner reports GHSA-g3hv-75wg-m249 in `minimatch` 10.2.6 (tool severity Medium). It is pre-existing: `pnpm-lock.yaml` is unchanged. It is a dev-only transitive dependency of `eslint`, and it is not in the Worker bundle. | Low (in context) | Follow-up: update `eslint` when a release takes `minimatch` 11.0.1+. No dependency change in this run. | Follow-up |
| F12 | Abuse cases | The scripts are local developer tools. They do not add a route, an endpoint, or a listener outside the test run. | Info | None needed. | Closed |

Counts: 0 High, 0 Medium, 6 Low (F2 and F3 fixed; F6 and F9 accepted; F7 and F11 follow-up), 7 Info.

## Verification after the fixes

- `pnpm exec vitest run tests/unit/scripts`: 4 files, 57 tests pass.
- `make check`: PASS.
- `VERIFY_PORT=abc node scripts/verify-local.mjs`: `FAIL select port`, exit 1.
- `make verify-local`: 10 checks `ok` on `127.0.0.1:5199`, PASS.

## Privacy review

- PII: none. The scripts handle no user data. The probe submission has a synthetic title and fixed HTML.
- Retention: the probe row and R2 object stay in local Miniflare state (`.wrangler/`, git-ignored). They never leave the machine.
- Consent and regulation: not applicable. No personal data and no remote transfer.
- Auditability: each run prints a deterministic PASS or FAIL list.

## Threat model

Not required. This change is not an auth or security change. The short attack surface analysis is in F1 to F12.

## Residual security risk

- Impact 2, Likelihood 2. Risk score 4. This is unchanged from gate 5 and is below tolerance 9.
- No hard-stop trigger. No auth change, no remote Cloudflare operation, no secret in git, no `wrangler.jsonc` change.
- Open Low items: F6, F7, F9, F11. F7 and F11 are follow-ups.
- Full tool output: [06-secops-report.md](06-secops-report.md).

## Jev quality check

The first check failed `sc_authz`. Row F0 now covers authentication and authorization. The second check still failed `sc_authz` (first item P(yes) = 0.15). The rubric is unchanged. Trigger `jev-quality-fail` is raised.

### jev-result
```
rubric: 6-security
verdict: reject
items: pass 4  uncertain 0  fail 1
failed: [sc_authz]
artifact: .sdlc/runs/local-cloudflare-dev-env/jev-6-security.md
```

### sdlc-result
```
gate: 6-security
status: escalate
risk-score: 4
impact: 2  likelihood: 2
findings: 0/0/6
hard-stop-triggers: [jev-quality-fail]
jev: reject
artifact: .sdlc/runs/local-cloudflare-dev-env/06-security-review.md
note: No Medium/High in context; 2 Low fixed in verify-local.mjs; Jev sc_authz rejected twice -> escalated.
```
