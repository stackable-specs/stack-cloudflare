# ADR-005: Dependency supply-chain policy

## Status

Accepted

## Context and Problem Statement

The template depends on fast-moving packages (`wrangler`, `workerd`, `miniflare`, Vite, Vitest). A compromised or broken release can reach a developer machine at the next install. pnpm on this team's machines enforces `minimumReleaseAge` (7 days), so `pnpm add <pkg>@latest` can fail. Install scripts of dependencies run arbitrary code.

## Decision Drivers

- Reproducible installs on each machine and in CI.
- A delay before a new release can reach the project.
- Install scripts only for packages that need native binaries.

## Considered Options

- Exact pins, the 7-day release-age delay, and an install-script allowlist.
- Caret ranges with a lockfile only.
- A private registry proxy.

## Decision Outcome

Chosen option: exact pins, the release-age delay, and an install-script allowlist, because together they give reproducible installs and a review window with no extra infrastructure.

We will:

- Pin each dependency to an exact version in `package.json`. `make health` reports each range.
- Pin pnpm with the `packageManager` field and install with `--frozen-lockfile` in `make build`.
- Keep the 7-day `minimumReleaseAge`. Select the newest version that is older than the cutoff.
- Allow install scripts only for `esbuild` and `workerd` in `pnpm-workspace.yaml` (`allowBuilds`).
- Use `@cloudflare/vitest-plugin`. The old name, `@cloudflare/vitest-pool-workers`, is deprecated.

## Consequences

- Good: installs are the same on each machine.
- Bad: security fixes arrive up to 7 days late unless an operator makes an exception.
- Bad: the newest Cloudflare release is not available on the day it ships.
- Neutral: the `minimatch` advisory (follow-up FB-04) waits for an eligible release.

## References

- `docs/specs/security/dependency-management.md`
- `docs/specs/platform/pnpm.md`
