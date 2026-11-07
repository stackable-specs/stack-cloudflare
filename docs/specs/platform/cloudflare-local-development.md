---
id: cloudflare-local-development
layer: platform
extends:
  - platform/cloudflare.md
  - interface/commands.md
---

# Cloudflare Local Development

## Purpose

Cloudflare ships an official local simulator for most Workers primitives. Wrangler starts Miniflare, and Miniflare runs the Worker in a local `workerd` process. `workerd` is the same open-source runtime that runs Workers in production. With this tool chain, a developer can build and test the full application on a laptop. There is no need for Docker Compose, a local PostgreSQL, LocalStack, or hand-written mocks of Cloudflare services. Hand-written mocks drift from the real binding behavior. Generic Node.js test environments do not have the Workers runtime APIs. This spec pins one local development model: the same binding interfaces in every environment, local state that is not shared with production, and a clear list of the behaviors that only a deployed environment can test.

## References

- **spec** `cloudflare` — Security and configuration baseline for Cloudflare accounts, zones, and Workers
- **spec** `commands` — The `build`, `run`, `check`, `health`, `clean` interface
- **external** `https://developers.cloudflare.com/workers/local-development/` — Local development
- **external** `https://developers.cloudflare.com/workers/local-development/bindings-per-env/` — Binding support per environment
- **external** `https://developers.cloudflare.com/workers/vite-plugin/` — Cloudflare Vite plugin
- **external** `https://developers.cloudflare.com/workers/testing/` — Testing Workers
- **external** `https://developers.cloudflare.com/workflows/build/local-development/` — Workflows local development

## Local support matrix

| Primitive       | Local mode                          |
| --------------- | ----------------------------------- |
| Workers         | Local `workerd` runtime             |
| D1              | Local SQLite database               |
| R2              | Local object storage                |
| Queues          | Local message delivery              |
| Workflows       | Local Workflow engine               |
| Durable Objects | Local simulation                    |
| KV              | Local simulation                    |
| Workers AI      | Remote only (use `"remote": true`)  |
| Vectorize       | Remote only (use `"remote": true`)  |

Local simulation is not a guarantee of identical production behavior.

## Environments

1. **Local** (default). Worker, D1, R2, Queues, and Workflows run in Miniflare. External services use test adapters.
2. **Hybrid**. The local Worker connects selected bindings to staging resources with `"remote": true`. Use this mode only for primitives that have no local simulation.
3. **Staging**. A deployed Cloudflare environment (`wrangler deploy --env staging`) with real resources, authentication, WAF, and rate limits.

## Rules

1. Use the official Cloudflare Vite plugin (`@cloudflare/vite-plugin`) for projects with a frontend, so that the frontend and the Worker run in one dev server with the real Workers runtime. Use `wrangler dev` for Worker-only projects.
2. Declare every binding in the committed `wrangler.jsonc`. Application code must use the same binding interfaces (`env.DB`, `env.ARTIFACTS`, …) in local, staging, and production.
3. Do not write hand-written mocks of D1, R2, Queues, Workflows, KV, or Durable Objects. Use the Miniflare simulation through Wrangler, the Vite plugin, or the Vitest integration.
4. Do not add Docker Compose, a local database server, or an S3 emulator to simulate a Cloudflare primitive that Miniflare supports.
5. Keep local state in `.wrangler/` and exclude `.wrangler/` from git. `make clean DEEP=1` must remove it.
6. Apply D1 schema changes only through numbered files in `migrations/`. Apply them locally with `wrangler d1 migrations apply <binding> --local`. `build` and `run` must apply pending local migrations.
7. Declare a separate set of resources for each deployed environment under `env.<name>` in `wrangler.jsonc`. Bindings are not inherited, so each environment must declare all of its bindings. Do not reuse `-dev` resources in staging or production.
8. Never point a development binding (`"remote": true`) at a production resource. Remote operations change real data and can cost money.
9. Keep local secrets in `.dev.vars`. Commit only `.dev.vars.example` with placeholder values. Use test credentials only.
10. Regenerate runtime types with `wrangler types` after each change to `wrangler.jsonc`. `check` must fail when the generated types are stale.
11. Use the Local Explorer (`/cdn-cgi/local/explorer` on the dev server port) to inspect D1 rows, R2 objects, and Workflow instances. Do not add temporary debug endpoints to the Worker for this purpose.
12. Run Workflow integration tests that need production behavior in a deployed staging environment. Workflows do not support remote bindings or `wrangler dev --remote`.
13. Do not use local Queues to test consumer concurrency. The local simulation does not simulate concurrent consumers.
14. Do not treat Miniflare or a local Worker as a security sandbox. Run untrusted code (for example, user-submitted JavaScript) only in an isolated VM or a dedicated sandbox.
15. Make each Queue consumer idempotent. Local and production Queues can deliver a message more than one time.

## Behaviors that need a deployed environment

- Global latency, traffic contention, and production failure modes of D1.
- WAF rules, rate limits, DNS configuration, and real authentication redirects.
- Queue consumer concurrency and Workflow behavior with real resources.
