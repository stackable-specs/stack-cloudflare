# Minimal Human Input Contract — local-cloudflare-dev-env

## Restated objective

Give stack-cloudflare a single, repeatable way to set up the local Cloudflare development environment and to prove that each local primitive (Worker, D1, R2, Queues, Workflows, Local Explorer) works.

## Intent

Set up and verify a local Cloudflare dev environment for stack-cloudflare.

## Context delta (inferred)

- The template already exists (base commit 3bde311). `make build`, `make check`, and `make e2e` pass.
- No single command checks the prerequisites (Node.js, pnpm, Chromium, free ports, `.dev.vars`).
- No single command starts the dev server, exercises every binding, and stops the server again.
- Port 5173 is in use on this machine (a `kubectl` port-forward). This already broke one e2e run.
- The project has no k8s manifests and no Docker Compose. That is by design (ADR-002). Gate 8 therefore validates with a direct local start.

## Priority (inferred)

Developer and agent speed, with deterministic PASS or FAIL output. No new runtime dependencies.

## Authority

Level 5, risk tolerance 9 (set by `/goal`). Escalate on: any production or remote Cloudflare operation, any change to `wrangler.jsonc` bindings for staging, any secret in git.

## Acceptance (drafted)

```gherkin
Feature: Local Cloudflare dev environment

  Scenario: Prerequisites are present
    Given Node.js 22+, pnpm 11, and installed dependencies
    When the developer runs "make doctor"
    Then each prerequisite reports "ok"
    And the command prints PASS and exits 0

  Scenario: A prerequisite is missing
    Given node_modules does not exist
    When the developer runs "make doctor"
    Then the output names the missing item and the fix ("make build")
    And the command prints FAIL and exits 1

  Scenario: Every local primitive works
    Given "make build" succeeded
    When the developer runs "make verify-local"
    Then a dev server starts on a free port
    And D1, R2, the Queue consumer, the Workflow, and the Local Explorer each report "ok"
    And the dev server stops
    And the command prints PASS and exits 0

  Scenario: The preferred port is busy
    Given another process listens on the preferred port
    When the developer runs "make verify-local"
    Then the command uses a different free port
    And it never sends requests to the other process

  Scenario: First-time setup
    Given a fresh clone
    When the developer runs "make setup"
    Then dependencies, types, local migrations, the Chromium browser, and .dev.vars exist
    And an existing .dev.vars is not overwritten
```
