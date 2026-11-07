# Project: stack-cloudflare

## Architecture

Cloudflare Workers base template: React + Vite frontend, a Worker API, D1, R2, Queues, and Workflows. Everything runs locally in `workerd` through `@cloudflare/vite-plugin`. Follows the stackable-specs methodology and the stack-base command interface.

## Key Commands

- `make build` — install, generate types, apply local D1 migrations, build (spec: interface/commands.md)
- `make run` — Vite dev server with the local Worker (spec: platform/cloudflare-local-development.md)
- `make check` — PASS or FAIL quality gate (spec: interface/commands.md)
- `make health` — project assessment
- `make clean` — reset; `DEEP=1` also removes `.wrangler/` and `node_modules/`
- `make e2e` — Playwright (spec: quality/playwright.md)
- `pnpm run cf-typegen` — regenerate `worker/worker-configuration.d.ts` after a `wrangler.jsonc` change

## Rules for agents

1. Read the relevant spec in `docs/specs/` before a change.
2. For a new behavior, write a BDR in `docs/bdr/` first. Then write a failing test (spec: practices/tdd.md).
3. Keep pure rules in `worker/domain/`. Do not import `cloudflare:*` there.
4. Do not mock Cloudflare bindings. Use `@cloudflare/vitest-plugin` tests in `tests/worker/` (spec: quality/workers-testing.md).
5. Change the D1 schema only with a new file in `migrations/`.
6. Make Queue consumers idempotent.
7. Do not add Docker Compose, local database servers, or S3 emulators.
8. Do not point a binding at production. Do not run `wrangler deploy` for production from a laptop.
9. Use the Local Explorer at `/cdn-cgi/local/explorer` to inspect local state.
10. Run `make check` before each commit. It must print `PASS`.

## Specs

| Layer        | Specs                                                              |
| ------------ | ------------------------------------------------------------------ |
| Interface    | `commands.md`                                                      |
| Platform     | `cloudflare.md`, `cloudflare-local-development.md`, `pnpm.md`      |
| Language     | `typescript.md`                                                    |
| Presentation | `react.md`                                                         |
| Quality      | `unit-testing.md`, `playwright.md`, `workers-testing.md`           |
| Practices    | `madr.md`, `bdr.md`, `tdd.md`, `git.md`, `conventional-commits.md` |
| Security     | `dependency-management.md`                                         |
| Delivery     | `github-actions.md`                                                |
