# ADR-006: Queue and Workflow publication pipeline

## Status

Accepted

## Context and Problem Statement

A submission must pass an evaluation before the system publishes it ([BDR-001](../bdr/001-publish-only-approved-artifact.md)). Evaluation and publication are slower than one HTTP request, they can fail, and Queues can deliver a message more than one time. A verification on 2026-11-07 found that the first implementation did not guarantee that the evaluated bytes, the approved hash, and the published bytes are the same bytes. This ADR records the corrected design.

## Decision Drivers

- The HTTP request must return quickly (`202`).
- Each stage must be safe when a message arrives two times.
- Publication must use only the bytes that passed evaluation.

## Considered Options

- A Queue consumer for evaluation and a Workflow for publication.
- One Workflow for evaluation and publication.
- Synchronous evaluation and publication in the HTTP request.

## Decision Outcome

Chosen option: a Queue consumer for evaluation and a Workflow for publication, because the Queue gives retries and a dead-letter queue, and the Workflow gives durable, named steps for publication.

We will:

1. Store the submission in R2 under `submissions/<id>/` and record its SHA-256 hash in D1 with the status `submitted`. Then send a Queue message.
2. In the Queue consumer, read the object one time, hash that buffer, and evaluate that same buffer. If the hash is not equal to the recorded hash, set the status to `failed`.
3. Change the status with a conditional update (`WHERE status = 'submitted'`), so that only one delivery can change the status.
4. Start the Workflow with the submission ID as the instance ID. Treat `instance.already_exists` as success, not as a retry.
5. In the Workflow, read, hash, and copy the same buffer in one step. Set the status to `failed` before each non-retryable error, and also when a step fails after all of its retries.
6. Keep the dead-letter queue as a holding queue until an operator adds an alert or a consumer.

## Consequences

- Good: each stage can retry with no duplicate publication.
- Good: tests in `tests/worker/submissions.test.ts` cover a swap of the content before evaluation, a hash mismatch in the Workflow, a missing object, concurrent and repeated deliveries, `already_exists`, a failed Workflow start, and a step that fails on every retry.
- Bad: a failed submission is final. A user must submit again.
- Bad: no consumer reads the dead-letter queue yet. A message there needs an operator.
- Neutral: the status values are `submitted`, `approved`, `rejected`, `published`, and `failed`.

## References

- [BDR-001](../bdr/001-publish-only-approved-artifact.md)
- `docs/specs/platform/cloudflare-local-development.md` rule 15
