# BDR-005: Local environment verification

## Status

Accepted

## Behavior

The project tells a developer, with one command, whether the local Cloudflare environment is ready and whether each local primitive works.

## Context

A new developer or agent must know if the machine is ready before work starts. Some machines have other processes on common ports. [ADR-004](../adr/004-local-setup-and-verification-commands.md) records the implementation decision.

## Acceptance Criteria

- AC-1: `make doctor` prints `PASS` and exits `0` when each prerequisite is present.
- AC-2: `make doctor` prints `FAIL`, names each missing prerequisite with a fix, and exits `1` when a prerequisite is missing.
- AC-3: `make verify-local` prints `PASS` and exits `0` when the routes, the database, the object store, the queue, the workflow, and the Local Explorer each work.
- AC-4: `make verify-local` sends no request to a port that another process holds.
- AC-5: `make setup` does not change an existing `.dev.vars` file.

## Verification

### Scenario 1: Prerequisites are present

- **Given** Node.js 22+, pnpm 11, and installed dependencies
- **When** the developer runs `make doctor`
- **Then** the output ends with `PASS` and the exit code is `0`

### Scenario 2: Dependencies are missing

- **Given** `node_modules` does not exist
- **When** the developer runs `make doctor`
- **Then** the output names `node_modules` with the fix `make build`, ends with `FAIL`, and the exit code is `1`

### Scenario 3: Each primitive works

- **Given** `make build` succeeded
- **When** the developer runs `make verify-local`
- **Then** the output reports `ok` for each primitive, ends with `PASS`, the exit code is `0`, and no dev server process remains

### Scenario 4: The preferred port is busy

- **Given** another process listens on port 5199
- **When** the developer runs `make verify-local`
- **Then** the command uses a different free port and sends no request to port 5199

### Scenario 5: Existing local secrets

- **Given** `.dev.vars` exists with the content `A=1`
- **When** the developer runs `make setup`
- **Then** `.dev.vars` still contains `A=1`

Tests: `tests/unit/scripts/doctor.test.ts`, `tests/unit/scripts/verify-local.test.ts`, `tests/unit/scripts/local-dev.test.ts`.
