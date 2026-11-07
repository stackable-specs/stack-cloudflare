---
id: unit-testing
layer: quality
extends: []
---

# Unit Testing

## Purpose

Unit tests are the cheapest, fastest place to catch a regression and the only test tier developers will run on every save — so when the suite is slow, flaky, order-dependent, or asserts on internal call counts, they stop running it and the safety net evaporates. The discipline only pays off when each test exercises one observable behavior, runs in milliseconds against in-memory substitutes, asserts on what callers can actually see, and either passes deterministically or fails with a message that points at the change. Without those constraints "unit tests" degrade into integration tests in disguise (real database, real clock, real network), implementation-detail mocks that re-break on every refactor, retry-masked flakes that hide real defects, or coverage-chasing assertion-free invocations that satisfy a percentage threshold while testing nothing. This spec pins the framework choice, the test layout, the AAA shape, what may and may not be asserted on, isolation requirements, and the CI gate, so a passing unit suite is a real signal — not just an attestation that the tests didn't crash.

## References

- **spec** `mutation-testing` — sibling quality-layer spec that gates on the strength of unit-test assertions
- **spec** `property-based-testing` — sibling quality-layer spec that complements example-based unit tests
- **spec** `tdd` — practices-layer red/green/refactor workflow that produces unit tests
- **external** `https://en.wikipedia.org/wiki/Unit_testing` — Unit testing overview
- **external** `https://en.wikipedia.org/wiki/Test_double` — Test doubles (dummy, stub, fake, spy, mock)
- **external** `http://wiki.c2.com/?ArrangeActAssert` — Arrange-Act-Assert pattern
- **external** `https://martinfowler.com/articles/mocksArentStubs.html` — Mocks Aren't Stubs (Fowler)
- **external** `https://agileinaflash.blogspot.com/2009/02/first.html` — FIRST principles (Fast, Isolated, Repeatable, Self-validating, Timely)

## Rules

1. Use a dedicated unit-testing framework appropriate to the language (pytest for Python, JUnit 5 for Java, vitest / jest / `bun:test` for JS/TS, xUnit or NUnit for .NET, RSpec or Minitest for Ruby, `go test` for Go, `cargo test` for Rust); do not roll your own assertion framework.
2. Place unit tests under a top-level test directory (or alongside source as `*_test.<ext>` files) per a single project-wide convention; do not scatter ad-hoc test files outside the chosen layout.
3. Name each test after the behavior under test in a form a reviewer can read as a sentence (e.g. `returns_empty_when_input_is_empty`, `raises_validation_error_for_negative_age`); do not name tests `test_<function>_1`, `test_<function>_2`.
4. Structure each test as Arrange / Act / Assert — setup, a single invocation of the unit under test, then assertions; do not interleave multiple invocations of the unit under test and their assertions in one test body.
5. Assert on observable behavior — return values, raised exceptions, persisted state, externally visible side effects — not on internal implementation details such as private fields, internal call counts on collaborators not on the unit's contract, or log strings.
6. Cover one behavior per test; do not batch unrelated behaviors into a single test method.
7. Make tests independent of execution order: each test sets up the state it depends on and tears down the state it produces; do not require tests to run in a specific order or share mutable module-level state.
8. Make tests deterministic and isolated from real time, real network, real filesystem (outside a per-test temp dir), and real databases — inject the clock as a dependency and use fakes, stubs, or in-memory substitutes for external collaborators; do not reach out to a live external service from a unit test.
9. Use the framework's fixtures / `setUp` / `beforeEach` for shared setup; do not duplicate non-trivial setup across tests when a fixture would express the same intent.
10. Use test doubles for collaborators outside the unit under test — prefer fakes (working in-memory implementations) over mocks (interaction-pattern assertions); do not mock the unit under test itself.
11. Do not branch production code on a "test mode" flag (`if process.env.NODE_ENV === 'test'`, `if testing:`, `#ifdef TEST`) to make code testable; refactor for dependency injection instead.
12. Run the full unit-test suite in pull-request CI on every change; do not allow a PR to merge with a failing unit test or with a skipped test that lacks a tracking reference.
13. Quarantine known-flaky tests behind an explicit annotation tied to a tracking ticket; do not configure CI to retry a failing test as a way to land work.
14. Keep the unit suite fast enough that developers run it on every save (target: full unit suite under 60 seconds for a typical service); do not let the suite drift past the threshold without splitting out integration-tier tests.
15. Gate on line and branch coverage as a floor — set a per-module minimum for new code (commonly 80%) — and pair it with mutation testing on pure-logic modules; do not treat a global coverage percentage as the sole quality signal. (refs: mutation-testing)
16. Refactor production code (extract collaborators, invert dependencies, narrow the interface) rather than weaken a test when a unit becomes hard to test; do not delete a failing test to make CI green without first understanding what behavior it was protecting.
17. When a bug is reported, write a unit test that reproduces it before fixing the defect; commit the failing test and the fix together so the regression is verifiably caught on subsequent runs.
