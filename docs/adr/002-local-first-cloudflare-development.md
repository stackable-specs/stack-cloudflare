# ADR-002 - Local-first Cloudflare development with the Vite plugin

## Status

Accepted

## Context

The application uses Workers, D1, R2, Queues, and Workflows. A conventional approach runs a Node.js backend with Docker Compose, PostgreSQL, an S3 emulator, and hand-written mocks of Cloudflare services. That approach differs from production in runtime and in binding behavior. Wrangler, Miniflare, and `workerd` simulate these primitives locally with the production binding interfaces.

## Decision

- Use `@cloudflare/vite-plugin` with React. One `vite` process serves the frontend with hot reload and runs the Worker in `workerd`.
- Declare D1, R2, Queues, and Workflows in `wrangler.jsonc`. Miniflare simulates them locally and keeps state in `.wrangler/`.
- Use `@cloudflare/vitest-plugin` for Worker integration tests inside `workerd`, and Playwright for end-to-end tests.
- Do not add Docker Compose, a local database server, LocalStack, or hand-written Cloudflare service mocks.

## Consequences

- Local code uses the same `env` bindings as production.
- No permanent local infrastructure. A new checkout needs only Node.js, pnpm, and `make build`.
- Agents can inspect local state through the Local Explorer at `/cdn-cgi/local/explorer`.
- Local simulation does not reproduce production latency, Queue concurrency, WAF, or rate limits. ADR-003 covers these gaps.
- Workers AI and Vectorize have no local simulation. They need remote bindings to staging.

## Alternatives Considered

| Option                                         | Pros                | Cons                                       | Why Not Selected                            |
| ---------------------------------------------- | ------------------- | ------------------------------------------ | ------------------------------------------- |
| Node.js + Docker Compose + mocks               | Familiar            | Different runtime, mock drift              | Not close to production                     |
| `wrangler dev` with a separate frontend server | Simple Worker setup | Two processes, no shared HMR               | Vite plugin is the official integrated path |
| Remote dev only (`wrangler dev --remote`)      | Real services       | Slow, costs money, Workflows not supported | Local mode is faster and free               |

## References

- `docs/specs/platform/cloudflare-local-development.md`
- `docs/specs/quality/workers-testing.md`
- https://developers.cloudflare.com/workers/local-development/
