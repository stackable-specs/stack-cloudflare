# Design Note — local-cloudflare-dev-env

- Gate: 2 — Design
- Change class: Infrastructure / deploy
- Input: `contract.md` (gate 1 is not in the gate profile)
- Date: 2026-11-07

## 1. Current state

- `Makefile` has the stack-base commands (`build`, `run`, `check`, `health`, `clean`) and the extensions `e2e`, `verify`, `migrate`, `seed`, `deploy-stage`.
- `scripts/check.mjs` and `scripts/health.mjs` use only Node.js built-ins. They print a deterministic result.
- `scripts/verify.mjs` runs four smoke checks against `BASE_URL`. The default is `http://localhost:5173`. It does not start a server.
- `vite.config.ts` uses `@cloudflare/vite-plugin`. One `vite` process runs the React frontend and the Worker in `workerd`.
- `playwright.config.ts` uses port `E2E_PORT` (default 5199) with `--strictPort`. It sets `reuseExistingServer: true` outside CI. Thus a foreign process on that port can receive test requests.
- The Worker exposes `GET /api/health` (D1 `SELECT 1`), `POST /api/submissions` (R2 put, D1 insert, Queue send), `GET /api/submissions/:id`, and `GET /api/submissions/:id/artifact` (only when the status is `published`).
- The Queue consumer evaluates the artifact and starts `PublicationWorkflow`. The Workflow copies the artifact to `published/<id>/index.html` and sets the D1 status to `published`.
- The Local Explorer is at `/cdn-cgi/local/explorer` on the dev server port.
- README prerequisites: Node.js 22+ and pnpm 11. `.dev.vars.example` contains only comments.
- Port 5173 on this machine is in use by a `kubectl` port-forward.

## 2. Gap analysis

| Contract scenario            | Current behavior                                                 | Gap                                                    |
| ---------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------ |
| Prerequisites are present    | No command checks Node.js, pnpm, Chromium, ports, or `.dev.vars` | Add `make doctor`                                      |
| A prerequisite is missing    | Failures appear late, inside `pnpm` or Playwright output         | `doctor` names the item and the fix, then exits 1      |
| Every local primitive works  | `make e2e` covers the flow through the UI, but needs Chromium    | Add `make verify-local`: start, exercise, stop         |
| The preferred port is busy   | `verify.mjs` defaults to 5173 and can hit `kubectl`              | Select a free port; confirm server identity            |
| First-time setup             | `make build` does not install Chromium or create `.dev.vars`     | Add `make setup`; do not overwrite `.dev.vars`         |

## 3. Solution options

### Option A — Node.js scripts with built-ins only (recommended)

Add `scripts/doctor.mjs` and `scripts/verify-local.mjs`. Add Makefile targets `setup`, `doctor`, and `verify-local`. Use only `node:child_process`, `node:net`, `node:fs`, and global `fetch`.

- Pros: Same pattern as `check.mjs` and `health.mjs`. Cross-platform. Deterministic PASS or FAIL. No new dependencies. Easy to read for agents.
- Cons: About 200 lines of new script code. Process-group cleanup needs care.

### Option B — Shell logic in the Makefile

Put the checks in Makefile recipes with `lsof`, `curl`, `node --version`, and `sleep` loops.

- Pros: No new files in `scripts/`.
- Cons: `lsof` and `curl` are external tools that are not prerequisites. Shell polling and JSON parsing are fragile. Output is hard to make deterministic. Process cleanup with `trap` in make recipes is unreliable.

### Option C — A Playwright project for verification

Add a second Playwright project that runs API checks through `request` and uses `webServer` to start the server.

- Pros: Reuses the Playwright `webServer` lifecycle.
- Cons: Needs Chromium installed for the full config. `reuseExistingServer` can reuse a foreign process on the port. It mixes smoke verification with e2e tests. `doctor` and `setup` still need another tool.

## 4. Tradeoff analysis

| Criterion        | A: Node scripts               | B: Makefile shell           | C: Playwright project         |
| ---------------- | ----------------------------- | --------------------------- | ----------------------------- |
| Complexity       | Low–medium                    | Medium (fragile)            | Medium                        |
| Risk             | Low                           | Medium (orphan processes)   | Medium (foreign-server reuse) |
| Cost             | None                          | None                        | None                          |
| Maintainability  | High (matches existing style) | Low                         | Medium                        |
| Security         | Local only, loopback only     | Local only                  | Local only                    |
| Performance      | One server start, ~10–20 s    | Same                        | Same, plus Playwright start   |
| Rollout safety   | Additive targets only         | Additive                    | Changes e2e config            |
| New dependencies | None                          | Implicit `lsof`, `curl`     | None                          |

Decision: Option A.

## 5. Recommended design

Add three additive Makefile extension targets and two Node.js scripts. Do not change Worker code, `wrangler.jsonc`, migrations, or the D1 schema. Do not run any remote Cloudflare operation.

### Decision Record DR-1 — Port selection and server identity

- Context: Port 5173 is busy. Vite without `--strictPort` silently moves to the next port. Then the script cannot know the URL. A foreign process can answer on a configured port.
- Decision: `verify-local` selects the port itself. It starts at `VERIFY_PORT` (default 5199, the same as e2e) and tests each candidate up to +20. A candidate is free only if a `node:net` server can listen on it on both `127.0.0.1` and `::1` (skip `::1` when IPv6 is not available). Then it starts `vite --port <p> --strictPort --host 127.0.0.1`. It sends requests only to `http://127.0.0.1:<p>`.
- Identity: before any check, the script confirms that the child process is alive and that `GET /api/health` returns JSON `{"status":"ok"}`. If the child exits early (for example, a port race), the script fails with the child output. It never falls back to an existing server.
- Consequence: There is a small race window between the probe and the Vite bind. `--strictPort` turns a lost race into a clear failure, not a wrong target.

### Decision Record DR-2 — Prove each primitive through the public API

- Context: Spec rule 11 forbids temporary debug endpoints. AGENTS.md rule 4 forbids mocks.
- Decision: Use the existing example flow as the probe. One `POST /api/submissions` with a fixed valid artifact writes R2 and D1 and sends a Queue message. A status change to `approved` or later proves the Queue consumer. The status `published` proves the Workflow. `GET .../artifact` proves the R2 copy that the Workflow made. `GET /cdn-cgi/local/explorer` with status 200 proves the Local Explorer.

## 6. Design detail

### 6.1 Architecture and components

| File                         | Change | Purpose                                                       |
| ---------------------------- | ------ | ------------------------------------------------------------- |
| `Makefile`                   | edit   | Add `setup`, `doctor`, `verify-local` to `.PHONY` and targets |
| `scripts/doctor.mjs`         | new    | Prerequisite checks, PASS or FAIL                             |
| `scripts/verify-local.mjs`   | new    | Start dev server, check primitives, stop server, PASS or FAIL |
| `package.json`               | edit   | Scripts `doctor` and `verify:local` (no dependency change)    |
| `README.md`, `AGENTS.md`     | edit   | Document the three targets and the port behavior              |
| `docs/specs/platform/cloudflare-local-development.md` | optional edit | Reference `doctor` and `verify-local` |

`make setup` recipe, in order:

1. `pnpm install --frozen-lockfile`
2. `pnpm run cf-typegen`
3. `pnpm run db:migrate:local`
4. `pnpm exec playwright install chromium`
5. `test -f .dev.vars || cp .dev.vars.example .dev.vars` (never overwrite)
6. `node scripts/doctor.mjs`

`make setup` does not run `pnpm run build`. `make build` stays unchanged. This keeps the stack-base `build` contract.

### 6.2 Command contract (the "API" of this change)

| Command             | Exit 0 output (last line) | Exit 1 output (last lines)       | Env vars                              |
| ------------------- | ------------------------- | -------------------------------- | ------------------------------------- |
| `make doctor`       | `PASS`                    | `FAIL` + `N failing checks`      | none                                  |
| `make verify-local` | `PASS`                    | `FAIL` + `N failing checks`      | `VERIFY_PORT` (default 5199), `VERIFY_TIMEOUT_MS` (default 60000) |
| `make setup`        | doctor `PASS`             | first failing step, or doctor `FAIL` | none                             |

Each check line has the format `ok   <name>`, `warn <name> — <detail>`, or `FAIL <name> — <detail>. Fix: <command>`. This matches `verify.mjs` style.

`doctor` checks:

| Check                 | ok when                                                    | Fix text                      | Severity |
| --------------------- | ---------------------------------------------------------- | ----------------------------- | -------- |
| node                  | `process.versions.node` major >= 22                        | install Node.js 22+           | FAIL     |
| pnpm                  | `pnpm --version` major == 11                               | `corepack enable`             | FAIL     |
| dependencies          | `node_modules/.modules.yaml` exists                        | `make build`                  | FAIL     |
| worker types          | `worker/worker-configuration.d.ts` exists                  | `pnpm run cf-typegen`         | FAIL     |
| chromium              | `chromium.executablePath()` from `@playwright/test` exists | `make setup`                  | FAIL     |
| .dev.vars             | `.dev.vars` exists                                         | `make setup`                  | FAIL     |
| local D1 state        | `.wrangler/state/v3/d1` exists                             | `make migrate`                | warn     |
| port 5173             | free                                                       | none; verify-local selects another port | warn |
| verify port           | a free port exists in `VERIFY_PORT`..+20                   | stop the process on the port  | FAIL     |

`doctor` must not import `@playwright/test` when `node_modules` is missing. It reports `chromium` as `FAIL` with fix `make build` in that case. The `dependencies` check runs first and names `make build`, as the contract requires.

`verify-local` checks (in order; a failed check does not stop the later independent checks, but the server always stops):

1. `server started` — child alive, health returns `{"status":"ok"}` within timeout.
2. `worker routes` — reuse the four checks from `verify.mjs` with `BASE_URL` set to the selected URL. Refactor `verify.mjs` to export its check list and keep its CLI behavior unchanged.
3. `d1 + r2 write` — `POST /api/submissions` returns 202 with an `id`.
4. `queue consumer` — `GET /api/submissions/:id` status leaves `submitted` within timeout.
5. `workflow` — status becomes `published` within timeout. Status `rejected` or `failed` is FAIL with the status in the detail.
6. `r2 published copy` — `GET /api/submissions/:id/artifact` returns 200 and the body equals the posted HTML.
7. `local explorer` — `GET /cdn-cgi/local/explorer` returns 200.

Poll interval: 250 ms. The fixed artifact title is `verify-local-<timestamp>`, so rows are easy to identify in the Local Explorer.

### 6.3 Data model / schema

No change. The probe adds one submission row to local D1 and two objects to local R2 in `.wrangler/`. That state is local only. `make clean DEEP=1` removes it. No migration.

### 6.4 State model (verify-local)

```
select-port ──► spawn-vite ──► wait-healthy ──► run-checks ──► stop-server ──► report
     │              │               │                │
     └─fail─────────┴──fail─────────┴──fail──────────┴────────► stop-server ──► report FAIL
```

- `spawn-vite` runs `pnpm exec vite --port <p> --strictPort --host 127.0.0.1` with `detached: true` (new process group). First it runs `pnpm run db:migrate:local`, the same as `make run`.
- `stop-server` sends `SIGTERM` to the process group (`process.kill(-pid)`). After 5 s it sends `SIGKILL`. It also runs on `SIGINT`, `SIGTERM`, and uncaught errors. On Windows it uses `taskkill /T /F /PID` (best effort; not a target platform).
- The child output is kept in a ring buffer (last 200 lines). It is printed only on FAIL.

### 6.5 Error handling

| Condition                             | Result                                                         |
| ------------------------------------- | -------------------------------------------------------------- |
| `node_modules` missing                | verify-local FAIL at once: "Run 'make build' first."           |
| No free port in range                 | FAIL `select port`, names the range                            |
| Vite exits before healthy             | FAIL `server started`, prints child output                     |
| Health timeout                        | FAIL `server started`, prints child output                     |
| Fetch error in a check                | That check FAIL with the error message                         |
| Status timeout                        | FAIL with the last status that the script saw                  |
| Script crash                          | Server stops, exit 1                                           |

### 6.6 Security

- Requests go only to `127.0.0.1:<selected port>`. Vite binds `127.0.0.1`, so the server is not on the LAN.
- No remote Cloudflare operation. The scripts never call `wrangler deploy`, `--remote`, or `--env staging`.
- No change to `wrangler.jsonc`, so no staging binding changes.
- `make setup` copies only `.dev.vars.example`, which has placeholders. `.dev.vars` stays in `.gitignore`. The scripts never print `.dev.vars` content.
- No new dependency, no auth or authz change.

### 6.7 Observability

- Deterministic line output and exit codes, the same as `check.mjs` and `verify.mjs`.
- On FAIL, print the selected URL, the submission id, and the last 200 lines of the Vite output.
- Worker logs stay in the Vite output (`observability.enabled` is already true).

### 6.8 Backward compatibility

- All Makefile changes are additive. `build`, `run`, `check`, `health`, `clean`, `e2e`, and `verify` keep their behavior.
- `verify.mjs` keeps its CLI and its `BASE_URL` default. The refactor only exports the check list.
- Out of scope (follow-up): set `reuseExistingServer: false` in `playwright.config.ts` to stop e2e from using a foreign server.

## 7. Risk reassessment

Formula from `state.md`: Impact + Likelihood.

- Impact 2: developer tooling only; no product code, schema, binding, or deployed surface changes.
- Likelihood 2: known patterns; the uncertain parts are process-group cleanup and the port probe race.
- Preliminary score: 4 (tolerance 9). Gate 3 sets the authoritative score.

Hard-stop triggers: none. No public API change, no schema migration, no new dependency, no auth change, no remote operation.

## 8. Risks

See the Risk Register (`03-risk-register.md`, gate 3). Inputs for gate 3:

- R1: Orphan `workerd` or `vite` process after a crash. Mitigation: process-group kill and signal handlers.
- R2: Port probe race. Mitigation: `--strictPort` and early-exit detection.
- R3: Workflow latency in local mode exceeds the timeout. Mitigation: `VERIFY_TIMEOUT_MS`.
- R4: `chromium.executablePath()` API change in a later Playwright version. Mitigation: pinned `@playwright/test` 1.64.1.

### jev-result
```
rubric: 2-design
verdict: pass
items: pass 6  uncertain 0  fail 0
failed: [none]
artifact: .sdlc/runs/local-cloudflare-dev-env/jev-2-design.md
```

### sdlc-result
```
gate: 2-design
status: passed
risk-score: 4
impact: 2  likelihood: 2
hard-stop-triggers: [none]
jev: pass
artifact: .sdlc/runs/local-cloudflare-dev-env/02-design-note.md
note: Option A — Node built-in scripts doctor.mjs + verify-local.mjs, Makefile setup/doctor/verify-local; own free-port selection with --strictPort on 127.0.0.1.
```
