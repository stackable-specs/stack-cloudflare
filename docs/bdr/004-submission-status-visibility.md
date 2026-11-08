# BDR-004: Submission status visibility

## Status

Accepted

## Behavior

The system shows each submission with its current status and the reasons for a rejection or a failure.

## Context

Evaluation and publication are asynchronous ([BDR-001](001-publish-only-approved-artifact.md)). The person who submits an artifact must be able to see if it was published, rejected, or failed, and why.

## Acceptance Criteria

- AC-1: `GET /api/submissions` returns `200` with a list of submissions, newest first, with at most 50 items.
- AC-2: Each item has `id`, `title`, `sha256`, `status`, `reasons`, `createdAt`, and `publishedAt`.
- AC-3: `GET /api/submissions/{id}` returns `200` with one item, or `404` for an unknown ID.
- AC-4: The status is one of `submitted`, `approved`, `rejected`, `published`, or `failed`.
- AC-5: The web page shows each submission title with its status, and updates the status with no page reload.

## Verification

### Scenario 1: Status of a new submission

- **Given** a client submitted an artifact and received an `id`
- **When** the client sends `GET /api/submissions/{id}`
- **Then** the status is `200` and the item has the same `id` and `sha256`

### Scenario 2: Rejection reasons are visible

- **Given** a submission that contains a `<script>` element was evaluated
- **When** the client requests that submission
- **Then** the status is `rejected` and `reasons` contains `artifact must not contain <script> elements`

### Scenario 3: Unknown submission

- **Given** no submission with the ID `00000000-0000-0000-0000-000000000000`
- **When** a client requests it
- **Then** the status is `404`

### Scenario 4: Live status in the web page

- **Given** the web page is open
- **When** a user submits an artifact
- **Then** the page shows the title with the status `published` within 20 seconds

Tests: `tests/worker/submissions.test.ts` ("BDR-004") covers Scenarios 1 and 3 and AC-1, AC-2, AC-4. The "BDR-001" AC-3 test covers Scenario 2. `e2e/submission.spec.ts` covers Scenario 4.
