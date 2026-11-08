# stack-cloudflare

A Cloudflare Workers base template that follows the [stackable-specs](https://github.com/stackable-specs) methodology and the [stack-base](https://github.com/stackable-specs/stack-base) command interface.

The full application runs on a laptop. Wrangler, Miniflare, and `workerd` simulate D1, R2, Queues, and Workflows locally. There is no Docker Compose, local database server, S3 emulator, or hand-written Cloudflare mock.

## Commands

| Command       | Result                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------- |
| `make build`  | Installs dependencies, generates Worker types, applies local D1 migrations, builds.         |
| `make run`    | Starts Vite (React HMR) and the Worker in local `workerd`.                                  |
| `make check`  | Format, lint, types, unit tests, Worker tests, stale-types check. Prints `PASS` or `FAIL`.  |
| `make health` | Graded project assessment with risks and recommendations.                                   |
| `make clean`  | Removes output. `make clean DEEP=1` also removes local Cloudflare state and `node_modules`. |

Extensions: `make setup`, `make doctor`, `make verify-local`, `make e2e`, `make verify`, `make migrate`, `make seed`, `make deploy-stage`. Run `make help` for the list.

## Prerequisites

- Node.js 22 or later
- pnpm 11 (`corepack enable`)

## Getting started

```sh
make setup        # first time: dependencies, types, local migrations, Chromium, .dev.vars, then doctor
make verify-local # start the dev server, prove each local primitive, stop the server
make run          # open the URL that Vite prints (usually http://localhost:5173)
make check
make e2e
```

`make setup` copies `.dev.vars.example` to `.dev.vars` only when `.dev.vars` does not exist. It never overwrites your local secrets.

### Local environment checks

| Command             | Result                                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `make doctor`       | Checks Node.js 22+, pnpm 11, `node_modules`, Worker types, Chromium, `.dev.vars`, local D1 state, ports. Prints `PASS` or `FAIL` with a fix for each failure.                                           |
| `make verify-local` | Starts Vite on a free loopback port, then proves the Worker routes, D1, R2, the Queue consumer, the Workflow, and the Local Explorer through the public API. Stops the server. Prints `PASS` or `FAIL`. |

`make verify-local` selects its own port. It starts at `VERIFY_PORT` (default 5199) and tests up to 20 more ports. It binds and sends requests only to `127.0.0.1:<port>` with `--strictPort`, so it never talks to another process on a busy port (for example, a port-forward on 5173). Set `VERIFY_TIMEOUT_MS` (default 60000) when the local Queue or Workflow is slow. Each run adds one `verify-local-<timestamp>` submission to local state; `make clean DEEP=1` removes it. Neither command runs a remote Cloudflare operation.

### Local Explorer

The dev server includes the Cloudflare Local Explorer at `http://localhost:<vite-port>/cdn-cgi/local/explorer`. Use it to inspect D1 rows, R2 objects, and Workflow instances.

## Example application

The template includes a small end-to-end flow that uses each primitive:

```
POST /api/submissions ─► R2 (submissions/<id>/index.html) + D1 (status=submitted)
        │
        └─► Queue: stack-cloudflare-evaluations
                 │  evaluateArtifact()  ─► D1 (approved | rejected)
                 └─► Workflow: PublicationWorkflow (instance id = submission id)
                          1. verify artifact hash  (must equal the approved hash)
                          2. copy to published/<id>/index.html
                          3. mark published in D1
```

| Route                               | Purpose                                   |
| ----------------------------------- | ----------------------------------------- |
| `GET /api/health`                   | D1 health check                           |
| `GET /api/submissions`              | List submissions                          |
| `POST /api/submissions`             | Submit `{ title, html }`                  |
| `GET /api/submissions/:id`          | One submission                            |
| `GET /api/submissions/:id/artifact` | Published content, served as `text/plain` |

Replace the example domain in `worker/domain/` with your own rules. BDR-001 defines the behavior and the tests prove it.

## Repository layout

```
.
├── .github/workflows/ci.yml   # build, check, e2e
├── docs/
│   ├── adr/                   # Architecture decisions (MADR)
│   ├── bdr/                   # Behavior decisions
│   └── specs/                 # Specs from stackable-specs, plus this stack's specs
├── e2e/                       # Playwright tests
├── fixtures/                  # Local R2 fixtures (make seed)
├── migrations/                # D1 migrations
├── scripts/                   # check, health, verify
├── src/client/                # React frontend
├── tests/
│   ├── unit/                  # Domain tests (Node.js)
│   └── worker/                # Integration tests in workerd
├── worker/
│   ├── domain/                # Pure rules, no Cloudflare imports
│   ├── index.ts               # fetch + queue handlers, Workflow export
│   ├── queue.ts               # Evaluation consumer
│   ├── workflow.ts            # PublicationWorkflow
│   └── repository.ts          # D1 access
├── Makefile                   # stack-base commands
├── vite.config.ts
├── vitest.config.ts
└── wrangler.jsonc             # Bindings for local and staging
```

## Included specs

| Spec                                                                         | Layer        | Source          |
| ---------------------------------------------------------------------------- | ------------ | --------------- |
| `interface/commands.md`                                                      | interface    | stack-base      |
| `platform/cloudflare.md`                                                     | platform     | stackable-specs |
| `platform/cloudflare-local-development.md`                                   | platform     | this stack      |
| `platform/pnpm.md`                                                           | platform     | stackable-specs |
| `language/typescript.md`                                                     | language     | stackable-specs |
| `presentation/react.md`                                                      | presentation | stackable-specs |
| `quality/unit-testing.md`                                                    | quality      | stackable-specs |
| `quality/playwright.md`                                                      | quality      | stackable-specs |
| `quality/workers-testing.md`                                                 | quality      | this stack      |
| `practices/madr.md`, `bdr.md`, `tdd.md`, `git.md`, `conventional-commits.md` | practices    | stackable-specs |
| `security/dependency-management.md`                                          | security     | stackable-specs |
| `delivery/github-actions.md`                                                 | delivery     | stackable-specs |

## Environments

| Environment | How                                                 | Use                                                       |
| ----------- | --------------------------------------------------- | --------------------------------------------------------- |
| Local       | `make run`                                          | Default. All bindings in Miniflare.                       |
| Hybrid      | `"remote": true` on one binding, pointed at staging | Workers AI, Vectorize, or a real-service check            |
| Staging     | `make deploy-stage` from CI                         | WAF, rate limits, auth, Queue concurrency, real Workflows |

Before the first staging deploy, create the staging resources and replace the `REPLACE_WITH_*` IDs in `wrangler.jsonc`. Never point a development binding at production.

## Known limits of local mode

- Local D1 does not reproduce global latency or production contention.
- Local Queues do not simulate concurrent consumers.
- Workflows cannot use remote bindings or `wrangler dev --remote`. Test them in staging.
- Miniflare is not a security sandbox. Run untrusted code only in an isolated VM.
- pnpm enforces a seven-day `minimumReleaseAge`. New package versions install only after that delay.
