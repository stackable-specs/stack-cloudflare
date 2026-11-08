# BDR-003: Published artifact retrieval

## Status

Accepted

## Behavior

The system returns the content of a published submission as plain text, and returns nothing for a submission that is not published.

## Context

Submitted HTML is untrusted. Users must be able to read a published artifact, but the artifact must not run in the application origin. [ADR-007](../adr/007-serve-published-artifacts-as-plain-text.md) records the implementation decision.

## Acceptance Criteria

- AC-1: For a published submission, `GET /api/submissions/{id}/artifact` returns `200` with the published content.
- AC-2: That response has the content type `text/plain; charset=utf-8` and the header `x-content-type-options: nosniff`.
- AC-3: For a submission that is not published, the same request returns `404`.
- AC-4: For an unknown ID, the same request returns `404`.

## Verification

### Scenario 1: Published artifact

- **Given** a submission with the status `published`
- **When** a client sends `GET /api/submissions/{id}/artifact`
- **Then** the status is `200`, the content type is `text/plain; charset=utf-8`, and the body equals the submitted content

### Scenario 2: Not yet published

- **Given** a submission with the status `submitted` or `rejected`
- **When** a client sends `GET /api/submissions/{id}/artifact`
- **Then** the status is `404`

### Scenario 3: Unknown submission

- **Given** no submission with the ID `00000000-0000-0000-0000-000000000000`
- **When** a client requests its artifact
- **Then** the status is `404`

Tests: `tests/worker/submissions.test.ts` covers Scenario 1. Scenarios 2 and 3 have no test yet.
