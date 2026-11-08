# ADR-004: Local setup and verification commands

## Status

Accepted

## Context and Problem Statement

[ADR-001](001-five-command-interface-with-make.md) defines five core commands and a list of extensions. A new developer or agent still has no single command that installs every prerequisite, no command that checks the prerequisites, and no command that proves each local Cloudflare primitive works. On this team's machines, other processes hold common ports (for example, a `kubectl` port-forward on 5173). A verification tool that sends requests to a shared port can test the wrong application.

## Decision Drivers

- No new runtime dependencies.
- Deterministic `PASS` or `FAIL` output, the same as `check`.
- No request to a port that another process holds.
- No remote Cloudflare operation.

## Considered Options

- Node.js standard-library scripts behind three new Make extensions.
- Playwright or Vitest as the verification runner.
- Shell scripts with `curl`.

## Decision Outcome

Chosen option: Node.js standard-library scripts, because they add no dependency and run on each platform that the project supports.

We will add three extensions to the list in ADR-001:

- `make setup` installs dependencies, generates Worker types, applies local D1 migrations, installs Chromium, and copies `.dev.vars.example` to `.dev.vars` only when `.dev.vars` does not exist. Then it runs `make doctor`.
- `make doctor` (`scripts/doctor.mjs`) checks Node.js 22+, pnpm 11, `node_modules`, Worker types, Chromium, `.dev.vars`, local D1 state, and ports.
- `make verify-local` (`scripts/verify-local.mjs`) selects a free port from `VERIFY_PORT` (default 5199), starts Vite with `--host 127.0.0.1 --strictPort`, proves the Worker routes, D1, R2, the Queue consumer, the Workflow, and the Local Explorer through the public API, and then stops the server.

## Consequences

- Good: a fresh checkout needs Node.js, pnpm, and `make setup`.
- Good: verification never sends a request to another process on a busy port.
- Bad: each `make verify-local` run adds one `verify-local-<timestamp>` submission to local state. `make clean DEEP=1` removes it.
- Neutral: `make e2e` still needs Chromium, which only `make setup` installs.

## References

- [ADR-001](001-five-command-interface-with-make.md)
- [ADR-002](002-local-first-cloudflare-development.md)
- `docs/specs/platform/cloudflare-local-development.md` rules 16 and 17
- [BDR-005](../bdr/005-local-environment-verification.md)
