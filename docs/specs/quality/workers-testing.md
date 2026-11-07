---
id: workers-testing
layer: quality
extends:
  - quality/unit-testing.md
  - quality/playwright.md
  - platform/cloudflare-local-development.md
---

# Workers Testing

## Purpose

Cloudflare-specific behavior (bindings, Queue acknowledgement, Workflow steps, D1 SQL) does not exist in a generic Node.js test environment. Tests that mock these bindings pass while the real integration fails. This spec defines three test levels. Each level has one tool and one scope, so that each test runs in the cheapest environment that can prove its behavior.

## References

- **spec** `unit-testing` — Unit-test scope and naming
- **spec** `playwright` — End-to-end test rules
- **spec** `cloudflare-local-development` — Local simulation model
- **external** `https://developers.cloudflare.com/workers/testing/vitest-integration/` — Workers Vitest integration
- **external** `https://developers.cloudflare.com/workflows/build/test-workflows/` — Testing Workflows

## Test levels

| Level                    | Tool                                          | Location        | Scope                                             |
| ------------------------ | --------------------------------------------- | --------------- | ------------------------------------------------- |
| Domain unit tests        | Vitest (Node.js)                              | `tests/unit/`   | Pure rules in `worker/domain/`. No bindings.      |
| Worker integration tests | Vitest + `@cloudflare/vitest-plugin` (workerd)| `tests/worker/` | Routes, D1, R2, Queue handlers, Workflows         |
| End-to-end tests         | Playwright against the Vite dev server        | `e2e/`          | User flows through the browser                    |

## Rules

1. Keep domain rules in `worker/domain/` with no `cloudflare:*` imports, so that unit tests run in Node.js.
2. Run Worker integration tests inside `workerd` with `@cloudflare/vitest-plugin`. Do not mock `env` bindings in these tests.
3. Apply the real D1 migrations in a Vitest setup file with `readD1Migrations()` and `applyD1Migrations()`.
4. Test Queue consumers with `createMessageBatch()` and `getQueueResult()`. Assert which messages the consumer acknowledges or retries.
5. Test Workflows with `introspectWorkflow()` and dispose each introspector (`await using`). Assert the final status and the side effects in D1 and R2.
6. For each behavior, test the success path and the failure paths: invalid input, duplicate delivery, changed data after approval, missing objects, and Workflow retry or error.
7. Run end-to-end tests against a dedicated dev server port with `--strictPort`. Do not let Playwright reuse an unknown server on a shared port.
8. Map each BDR verification scenario to at least one test. Put the BDR ID in the test name or a comment.
9. `check` runs the unit and Worker levels. End-to-end tests run with `make e2e` and in CI.
