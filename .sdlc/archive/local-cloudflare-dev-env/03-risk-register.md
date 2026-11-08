# Risk Register — local-cloudflare-dev-env

- Gate: 3 — Risk
- Change class: Infrastructure / deploy
- Inputs: `contract.md`, `state.md`, `02-design-note.md` (gate 1 skipped; no `01-requirements-brief.md`)
- Date: 2026-11-07
- Risk formula (frozen, from `state.md`): Impact + Likelihood (range 2–10)
- Risk tolerance: 9

## 1. Risk table

| #  | Risk | Category | Severity | Likelihood | Mitigation | Owner |
|----|------|----------|----------|------------|------------|-------|
| R1 | Orphan `vite` or `workerd` process stays alive after a crash or Ctrl-C. It holds the port and blocks later runs. | Operational | Med | Med | Spawn with `detached: true`. Kill the process group (`process.kill(-pid)`), `SIGTERM` then `SIGKILL` after 5 s. Run the stop step on `SIGINT`, `SIGTERM`, `exit`, and uncaught errors. Gate 5 tests the abort path. | Agent (gate 4) |
| R2 | Port probe race: another process binds the port between the probe and the Vite bind. | Technical | Low | Low | `--strictPort` turns the race into an early exit. Early-exit detection reports FAIL with child output. The script never falls back to another server. | Agent (gate 4) |
| R3 | Requests go to a foreign process (for example the `kubectl` port-forward on 5173). | Security / Technical | Med | Low | Own port selection from 5199. Bind and fetch only `127.0.0.1:<p>`. Confirm the child is alive and health returns `{"status":"ok"}` before any check. | Agent (gate 4) |
| R4 | Local Queue or Workflow latency exceeds the timeout. This gives a false FAIL. | Technical | Low | Med | `VERIFY_TIMEOUT_MS` (default 60000). Report the last status that the script saw. | Agent (gate 4) |
| R5 | `chromium.executablePath()` API changes in a later Playwright version. | Technical | Low | Low | `@playwright/test` is pinned at 1.64.1. Wrap the call in try/catch and report FAIL with fix `make setup`. | Agent (gate 4) |
| R6 | The `verify.mjs` refactor (export of the check list) changes its CLI behavior. `make verify` breaks. | Delivery | Med | Low | Keep the CLI entry point and the `BASE_URL` default. Gate 5 runs `make verify` against a dev server before and after. | Agent (gate 4/5) |
| R7 | `make setup` overwrites an existing `.dev.vars` and loses developer secrets. | Security | High | Low | Recipe uses `test -f .dev.vars \|\| cp ...`. Gate 5 tests the "existing file" case. Scripts never print `.dev.vars` content. | Agent (gate 4/5) |
| R8 | A script accidentally runs a remote Cloudflare operation (`wrangler deploy`, `--remote`, `--env staging`). | Security / Operational | High | Low | Design forbids these. Gate 6 greps new scripts and Makefile targets for `deploy`, `--remote`, `--env`. `db:migrate:local` only. | Agent (gate 6) |
| R9 | The probe adds rows to local D1 and objects to local R2. Local state grows over many runs. | Operational | Low | High | Data is local only in `.wrangler/`. Title `verify-local-<timestamp>` makes rows easy to identify. `make clean DEEP=1` removes the state. Accept. | Developer |
| R10 | `playwright install chromium` downloads a large browser binary during `make setup`. It can fail on offline or restricted networks. | Delivery | Low | Med | It is an existing dev dependency, not a new one. `doctor` reports `chromium` FAIL with the fix. `make build` and `make verify-local` do not need Chromium. | Developer |
| R11 | `doctor` imports `@playwright/test` when `node_modules` is missing and crashes, not FAIL. | Technical | Low | Med | Check `dependencies` first. Use a dynamic import only when `node_modules` exists. Gate 5 tests the missing-`node_modules` scenario. | Agent (gate 4/5) |
| R12 | Windows process-tree kill is best effort. | Operational | Low | Low | Windows is not a target platform. `taskkill /T /F /PID`. Document. | Agent (gate 4) |

Every High and Med risk (R1, R3, R6, R7, R8) has a mitigation and a gate that checks it.

## 2. Risk classification

| Dimension | Rating | Reason |
|-----------|--------|--------|
| Impact | Low | Developer tooling only. No Worker code, schema, binding, or deployed surface change. |
| Blast radius | Low | Local machine only. Additive Makefile targets. Existing targets keep their behavior. |
| Complexity | Low–Med | About 200 lines of Node.js built-in code. Process-group cleanup and the port probe need care. |
| Uncertainty | Low | Requirements are explicit in the contract (5 Gherkin scenarios). The design has no open questions. |

## 3. Risk score

- Impact: 2 — a failure blocks or confuses local verification. It cannot affect production or data outside `.wrangler/`.
- Likelihood: 2 — known patterns that match `check.mjs` and `verify.mjs`. The uncertain parts (R1, R2, R4) have mitigations and tests.
- Risk score: 2 + 2 = **4** (tolerance 9).
- Formula drift: none. Gate 2 used the same formula and the same preliminary score.

## 4. BDR / conformance impact

No open question changes a schema, data model, or persisted on-disk surface. The D1 schema, migrations, and `wrangler.jsonc` stay unchanged. The probe writes rows through the existing public API, so all existing BDRs and spec rules stay preserved. Spec rule 11 (no temporary debug endpoints) and AGENTS.md rule 4 (no mocks) are preserved by DR-2.

## 5. Hard-stop escalation checklist

| Trigger | Fired | Note |
|---------|-------|------|
| Auth / authz | no | No auth change. |
| Payments | no | — |
| PII / sensitive data | no | `.dev.vars` is never overwritten or printed (R7). |
| Schema / data migration | no | No schema change. Only existing local migrations run. |
| Public API break | no | Worker API unchanged. `verify.mjs` CLI unchanged. |
| New dependency | no | Node.js built-ins only. Chromium comes from the existing `@playwright/test`. |
| Production deployment | no | No remote operation. Gate 8 validates with a local start (ADR-002). |
| Failed tests (unclear cause) | no | Baseline `make build`, `make check`, `make e2e` pass. |
| Security scan failure | no | Not run yet (gate 6). |
| Ambiguous requirements / >20% uncertainty | no | Contract has explicit acceptance scenarios. |
| Exceeds approved scope | no | Matches the contract. `reuseExistingServer` fix is a follow-up. |
| Contract escalation: remote Cloudflare op, staging binding change, secret in git | no | All three are excluded by design (R8, §6.6). |

## 6. Escalation decision

Escalation required: **No** — no hard-stop trigger fired, and the risk score 4 is below the tolerance 9.

## 7. Follow-ups

- Set `reuseExistingServer: false` in `playwright.config.ts` (out of scope for this run).

## 8. Residual risk

After mitigation, the residual risk is Low. The largest remaining items are R1 (orphan process after `SIGKILL` of the parent script) and R4 (slow local Workflow). Both affect only the local machine. A developer can recover with `make clean` or a larger `VERIFY_TIMEOUT_MS`.

## 9. Jev review items

The Jev verdict is `review`. This does not block the gate. Uncertain items:

- "each risk has impact and likelihood" (P=0.52): each row has Severity (impact) and Likelihood columns.
- "states residual risk" (P=0.49): §8 now states the residual risk.

### jev-result
```
rubric: 3-risk
verdict: review
items: pass 3  uncertain 2  fail 0
failed: [none]
artifact: .sdlc/runs/local-cloudflare-dev-env/jev-3-risk.md
```

### sdlc-result
```
gate: 3-risk
status: passed
risk-score: 4
impact: 2  likelihood: 2
risk-tolerance: 9
hard-stop-triggers: [none]
jev: review
escalate-reason: none
artifact: .sdlc/runs/local-cloudflare-dev-env/03-risk-register.md
note: 12 risks, all High/Med mitigated; local-only tooling, no remote ops, no schema or dependency change.
```
