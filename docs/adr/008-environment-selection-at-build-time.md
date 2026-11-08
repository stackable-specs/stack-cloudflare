# ADR-008: Environment selection at build time

## Status

Accepted

## Context and Problem Statement

[ADR-003](003-three-environments.md) defines a staging environment in `wrangler.jsonc` and a `make deploy-stage` target. With `@cloudflare/vite-plugin`, the build writes a redirected Wrangler configuration for one environment, and `wrangler deploy` uses that output configuration. A dry run on 2026-11-07 showed that `make deploy-stage` ignores `--env staging` and deploys with the dev bindings. ADR-003 also says that production is a separate environment, but `wrangler.jsonc` has no production environment.

## Considered Options

- Select the environment at build time with `CLOUDFLARE_ENV=<name>`.
- Keep separate Wrangler configuration files for each environment.

## Decision Outcome

Chosen option: select the environment at build time with `CLOUDFLARE_ENV`, because the Vite plugin supports it and `wrangler.jsonc` stays the single source.

We will:

- Change `deploy:stage` to `CLOUDFLARE_ENV=staging pnpm run build && wrangler deploy`.
- Add a `make deploy-stage-dry` extension (`build:stage` and `wrangler deploy --dry-run`). Use it to confirm the `-staging` binding names before each real deploy.
- State that production is not defined yet. Add `env.production`, its resources, and a CI-only deploy job in a later ADR.
- Add a `make migrate-stage` extension for `db:migrate:stage`.

## Consequences

- Good: a staging deploy uses the staging resources.
- Bad: a bare `wrangler deploy` still uses the local development bindings. Only documentation (README, `wrangler.jsonc`) warns against it.
- Neutral: the CI deploy job stays commented out until the `REPLACE_WITH_*` IDs are real.

## References

- [ADR-003](003-three-environments.md)
- `docs/specs/platform/cloudflare.md` rule 15
- https://developers.cloudflare.com/workers/vite-plugin/ (Cloudflare environments)
