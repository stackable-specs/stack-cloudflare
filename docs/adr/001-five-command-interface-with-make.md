# ADR-001 - Five-command interface with Make

## Status

Accepted

## Context

The stack-base specification (`docs/specs/interface/commands.md`) requires five commands: `build`, `run`, `check`, `health`, and `clean`. This project uses pnpm scripts for tool commands. Developers and agents need one entry point that does not change between stackable projects.

## Decision

A `Makefile` exposes the five commands. Each target calls pnpm scripts or a Node.js script in `scripts/`. Project-specific commands (`e2e`, `verify`, `migrate`, `seed`, `deploy-stage`) are extensions.

- `make build` installs with a frozen lockfile, generates Worker types, applies local D1 migrations, and builds.
- `make run` applies local migrations and starts the Vite dev server with the local Worker.
- `make check` runs format, lint, types, unit tests, Worker tests, and a stale-types check. It prints `PASS` or `FAIL`.
- `make health` prints a graded assessment.
- `make clean` removes output. `make clean DEEP=1` also removes `.wrangler/` and `node_modules/`.

## Consequences

- The same commands work in every stackable project.
- `make` must be installed. It is present on macOS and Linux by default.
- pnpm scripts stay available for direct use.

## Alternatives Considered

| Option                    | Pros          | Cons                                            | Why Not Selected            |
| ------------------------- | ------------- | ----------------------------------------------- | --------------------------- |
| pnpm scripts only         | No extra tool | Names differ from stack-base (`pnpm run check`) | Breaks the shared interface |
| Shell scripts (`./build`) | No extra tool | Five more files, no help target                 | Make is simpler             |

## References

- `docs/specs/interface/commands.md`
- https://github.com/stackable-specs/stack-base
