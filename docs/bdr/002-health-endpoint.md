# BDR-002: Health endpoint

## Status

Accepted

## Behavior

The system reports through one HTTP endpoint whether it can answer requests that need its database.

## Context

Operators, `make verify`, and `make verify-local` need one cheap request that tells them if a deployment or a local dev server is ready. A static response is not enough, because the most common local failure is a database with no migrations.

## Acceptance Criteria

- AC-1: `GET /api/health` returns `200` with the JSON body `{"status":"ok"}` when the database answers.
- AC-2: The response has the content type `application/json`.
- AC-3: The endpoint needs no authentication and no request body.

## Verification

### Scenario 1: Healthy service

- **Given** a running service with an available database
- **When** a client sends `GET /api/health`
- **Then** the status is `200`
- **And** the body is `{"status":"ok"}`

Tests: `tests/worker/submissions.test.ts` ("GET /api/health"), `scripts/verify.mjs`.
