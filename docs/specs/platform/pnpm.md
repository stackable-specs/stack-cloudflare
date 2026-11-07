---
id: pnpm
layer: platform
extends:
  - npm
---

# pnpm

## Purpose

pnpm is a content-addressable package manager for Node.js that stores each dependency version once in a global store and links it into projects via hard links, preventing phantom dependency access through a non-flat `node_modules` layout. Without shared conventions, teams re-enable flat hoisting with `shamefully-hoist`, mix pnpm with npm or yarn commands, omit the `packageManager` field so contributors use mismatched pnpm versions, and manage monorepo workspace dependencies with file-path references instead of the `workspace:` protocol. This spec establishes the rules that keep pnpm's isolation guarantees intact, monorepo wiring consistent, and the global store maintainable.

## Do

- Pin the pnpm version in `package.json` via the `packageManager` field.
- Use `pnpm-workspace.yaml` to declare monorepo packages; use `workspace:*` to reference them.
- Use `pnpm exec` to run binaries from local `node_modules`.
- Use `pnpm --filter <package>` to scope commands to specific workspace packages.
- Prune the global store periodically with `pnpm store prune`.

## Don't

- Enable `shamefully-hoist=true` — it recreates npm's flat layout and allows phantom dependency access.
- Mix `npm install` or `yarn install` commands in a project that uses pnpm.
- Use `file:` path references for intra-workspace dependencies — use `workspace:` protocol instead.
- Run `npx` to invoke local binaries; use `pnpm exec` or a `package.json` script instead.

## References

- **spec** `npm` — npm registry, manifest, versioning, and lockfile rules this spec extends
- **external** `https://pnpm.io/motivation` — content-addressable store and non-flat node_modules design
- **external** `https://pnpm.io/workspaces` — pnpm-workspace.yaml and workspace: protocol reference

## Rules

1. Set the `packageManager` field in the root `package.json` to the exact pnpm version in use (e.g., `"packageManager": "pnpm@9.x.x"`); do not rely on an ambient pnpm version installed globally.
2. Do not set `shamefully-hoist=true` in `.npmrc`; pnpm's non-flat `node_modules` layout is the mechanism that prevents phantom dependency access.
3. Declare all monorepo workspace packages in `pnpm-workspace.yaml` at the repository root; do not use the `workspaces` field in `package.json`.
4. Reference intra-workspace packages using the `workspace:` protocol (e.g., `"@org/lib": "workspace:*"`); do not use `file:` path references or install workspace packages from the registry.
5. Use `pnpm exec <binary>` to invoke executables from local `node_modules`; do not use `npx` for local binaries as it may resolve a different version from the registry.
6. Scope commands to specific workspace packages using `pnpm --filter <package-name> <command>`; do not change directory into individual packages to run pnpm commands unless the workflow explicitly requires it.
7. Keep `shared-workspace-lockfile=true` (the default) in monorepos so a single `pnpm-lock.yaml` at the root covers all packages; do not disable it without a documented justification.
8. Do not install dependencies from separate package directories with isolated lockfiles in a workspace — use the root `pnpm install` to manage the full dependency graph.
9. Run `pnpm store prune` as part of periodic CI cache maintenance to remove content-addressable store entries that are no longer referenced by any project.
10. When adding peer dependencies that conflict, set `strict-peer-dependencies=false` in `.npmrc` only after documenting why the conflict is intentionally accepted; do not disable it globally as a shortcut.
