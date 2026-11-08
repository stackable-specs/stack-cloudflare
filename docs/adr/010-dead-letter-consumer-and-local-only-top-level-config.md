# ADR-010: Dead-letter consumer and local-only top-level config

## Status

Accepted

## Context and Problem Statement

[ADR-006](006-queue-and-workflow-publication-pipeline.md) item 6 kept the dead-letter queue as a holding queue with no consumer. A message there left its submission in `submitted` or `approved` until an operator acted. ADR-006 item 4 detected a repeated Workflow start by the text of the error message, and that text is not a stable contract. [ADR-008](008-environment-selection-at-build-time.md) records that only documentation warns against a bare `wrangler deploy`, which uses the local top-level config.

## Decision Drivers

- No submission may wait for an operator with no visible status.
- No logic may depend on the text of an error message.
- A deploy by mistake must not expose a public URL.

## Considered Options

- A dead-letter consumer in the same Worker, an instance lookup after a failed `create`, and a local-only top-level config.
- An alert on the dead-letter queue depth, with manual recovery.
- A wrapper script that refuses a bare deploy.

## Decision Outcome

Chosen option: the dead-letter consumer, the instance lookup, and the local-only top-level config, because they need no new service, and Wrangler cannot run a wrapper script for a direct `wrangler deploy`.

We will:

1. Consume `stack-cloudflare-evaluations-dlq` (and the `-staging-dlq` queue) in the same Worker. `handleQueue` sends a batch from a queue whose name ends in `-dlq` to `handleDeadLetterBatch`. That handler changes a `submitted` or `approved` submission to `failed` with the reason `evaluation failed after all retries`, does not change a final status, and acknowledges each message.
2. When `create` fails, look up the instance with `PUBLICATION_WORKFLOW.get(id)`. If the instance exists, treat the start as a success. If it does not exist, retry the message. Do not parse the error text.
3. Name the top-level Worker `stack-cloudflare-local-do-not-deploy` and set `workers_dev: false` and `preview_urls: false` at the top level. Set `workers_dev: true` in `env.staging`.

## Consequences

- Good: each submission ends in a visible final status, also after all retries fail.
- Good: a bare `wrangler deploy` makes a Worker with a clear name and no public URL. The zero-UUID `database_id` cannot point at a real database.
- Bad: a bare deploy can still upload a Worker. Only an API token that CI alone holds can stop that (`docs/specs/platform/cloudflare.md` rule 15).
- Neutral: ADR-006 items 4 and 6 are refined by this ADR. The rest of ADR-006 stays in force.

## References

- [ADR-006](006-queue-and-workflow-publication-pipeline.md)
- [ADR-008](008-environment-selection-at-build-time.md)
- Tests: `tests/worker/submissions.test.ts` ("ADR-010 dead-letter consumer", "BDR-001 AC-6")
