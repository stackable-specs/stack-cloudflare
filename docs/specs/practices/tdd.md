---
id: tdd
layer: practices
extends: []
---

# Red-Green-Refactor Test-Driven Development

## Purpose

Test-driven development's value depends entirely on the order of operations: write a failing test, make it pass with minimum code, refactor under a green suite. Skipping the red step, batching tests ahead of implementation, or refactoring while red silently converts "TDD" into "tests written later" — which looks the same in the diff but gives up the regression safety, design pressure, and executable-specification properties that justify the practice. This spec pins the cycle discipline so a reviewer can verify from commits and behavior that the workflow was actually followed, not merely claimed.

## References

- **external** `https://blog.cleancoder.com/uncle-bob/2014/12/17/TheCyclesOfTDD.html` — Robert C. Martin on the Three Laws and the cycles of TDD
- **external** `https://martinfowler.com/bliki/TestDrivenDevelopment.html` — Martin Fowler on TDD
- **external** `http://wiki.c2.com/?TestDrivenDevelopment` — C2 wiki: Test-Driven Development
- **external** `https://martinfowler.com/bliki/BeckDesignRules.html` — Beck's four rules of simple design (refactor-phase targets)

## Rules

1. Write a failing test before writing any production code that changes observable behavior.
2. Run the new test and confirm it fails before writing any implementation for it.
3. Verify the failure is an assertion failure or a missing-implementation error, not a syntax error, import error, or test-setup mistake.
4. Write the minimum production code required to make the current failing test pass.
5. Do not add production code that no currently failing test requires.
6. Run the full test suite and confirm every test passes before moving on from the green step.
7. Refactor only while the full test suite is green.
8. Do not change observable behavior during a refactor; the same tests must continue to pass without modification.
9. When a refactor breaks any test, revert or fix the regression before starting new work.
10. Write one failing test at a time; do not queue multiple failing tests before producing the code for the first.
11. If a newly written test passes without any production change, rewrite it to exercise new behavior or delete it.
12. Keep each red-green-refactor cycle under roughly ten minutes of elapsed time.
13. When a cycle exceeds the time budget, revert to the last green commit and split the problem into smaller cycles.
14. Commit only at green states (after a passing implementation or a completed refactor); do not commit while any test is red.
15. Do not skip, disable, or comment out failing tests to reach green.
16. Every quarantined, skipped, or `xfail`-marked test must reference a tracking issue or removal date in a comment at the skip site.
17. Reproduce every bug fix with a failing test that fails because of the bug before writing the fix.
18. Name tests to describe the behavior under test and its expected outcome, not the function name or internal implementation.
