# ADR-003 - Local, hybrid, and staging environments

## Status

Accepted

## Context

Local simulation covers most behavior (ADR-002). Some behavior needs real Cloudflare resources: Workers AI, Vectorize, WAF, rate limits, authentication redirects, Queue concurrency, and Workflows with real resources. Workflows do not support remote bindings.

## Decision

The project has three environments:

1. **Local** — the default. All bindings run in Miniflare.
2. **Hybrid** — the local Worker with `"remote": true` on selected bindings that point to staging resources. Only for primitives with no local simulation.
3. **Staging** — `env.staging` in `wrangler.jsonc`, with its own D1 database, R2 bucket, Queues, and Workflow. Deploy with `make deploy-stage` from CI. Run `make verify BASE_URL=<staging URL>` after each deploy.

Production is a separate environment with separate resources. It is deployed only from CI (spec: `platform/cloudflare.md` rule 15).

## Consequences

- Integration, concurrency, and failure-recovery tests run in staging before a production release.
- Staging resource IDs in `wrangler.jsonc` are placeholders until an operator creates the resources. `make health` reports them.
- Each environment declares all of its bindings, because Wrangler does not inherit bindings into environments.

## Alternatives Considered

| Option                                | Pros            | Cons                                                 | Why Not Selected                         |
| ------------------------------------- | --------------- | ---------------------------------------------------- | ---------------------------------------- |
| Local and production only             | Fewer resources | No place to test WAF, concurrency, or real Workflows | Too much risk                            |
| Remote bindings to production for dev | Real data       | Changes real data, costs money                       | Prohibited by the local development spec |

## References

- ADR-002
- `docs/specs/platform/cloudflare-local-development.md`
