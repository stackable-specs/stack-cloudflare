# BDR-001: Publish only the approved artifact

## Status

Accepted

## Behavior

The system publishes an artifact only when its content is identical to the content that passed evaluation.

## Context

A submission goes through two asynchronous stages: a Queue consumer evaluates it, and a Workflow publishes it. The stored artifact can change between these stages. A duplicate Queue message can also arrive. The system must not publish content that the evaluation did not approve, and it must not publish one submission two times.

## Acceptance Criteria

- AC-1: A valid submission returns `202` with an `id` and the SHA-256 hash of the content.
- AC-2: An invalid submission returns `400` with a list of errors and stores nothing.
- AC-3: An artifact that fails evaluation gets the status `rejected` with reasons, and no publication starts.
- AC-4: An approved artifact gets the status `published`, and the published copy is identical to the submitted content.
- AC-5: If the stored artifact changes after submission, the publication fails with the status `failed`, and no published copy exists.
- AC-6: A duplicate evaluation message does not start a second publication.

## Verification

### Scenario 1: Approved artifact is published

- **Given** a valid HTML artifact with no `<script>` element
- **When** a client submits it and the evaluation message is delivered
- **Then** the submission status is `published` and `GET /api/submissions/{id}/artifact` returns the same content

### Scenario 2: Artifact changed after approval

- **Given** a submitted artifact
- **When** the stored object is replaced with different content before publication
- **Then** the Workflow ends in `errored`, the status is `failed`, and no published object exists

### Scenario 3: Duplicate delivery

- **Given** a submitted artifact
- **When** the evaluation message is delivered two times
- **Then** exactly one publication Workflow instance exists

### Scenario 4: Rejected artifact

- **Given** an HTML artifact with a `<script>` element
- **When** the evaluation message is delivered
- **Then** the status is `rejected` and no Workflow instance exists

Tests: `tests/worker/submissions.test.ts`, `e2e/submission.spec.ts`.
