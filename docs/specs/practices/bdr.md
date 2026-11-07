---
id: bdr
layer: practices
extends: []
---

# Behavior Decision Records (BDR)

## Purpose

ADRs capture *how* the system is built — frameworks, schemas, configuration — but they do not tell a reader, a tester, or an autonomous agent *what the system must actually do for users*. Without a separate record of externally observable contracts, intent is reconstructed by reading code and tests, which conflates implementation with promise, lets behavioral scope creep silently, and makes regressions invisible until users notice. BDRs split that concern: each one captures a single capability the system agrees to uphold, with acceptance criteria a black-box observer could confirm and Given / When / Then scenarios that drop straight into integration tests. This spec pins the BDR format, lifecycle, and naming so the behavior log stays a reliable, machine-checkable contract about what the system does for users — distinct from the architectural log captured by ADRs.

## References

- **spec** `madr` — sibling format for architectural decisions; describes how the BDR / ADR split is maintained
- **external** `https://medium.com/devops-ai/behavior-decision-records-specifying-what-a-system-must-do-before-deciding-how-to-build-it-704876062688` — Behavior Decision Records: specifying what a system must do before deciding how to build it

## Rules

1. Store BDRs in a single directory (commonly `docs/bdr/`) and document its location in the repository README.
2. Name each BDR file `NNN-kebab-title.md`, where `NNN` is a three-digit zero-padded sequence number and the title is kebab-case.
3. Assign sequence numbers monotonically; do not reuse a retired number or rewrite history to re-number merged BDRs.
4. Begin every BDR with a level-1 heading that matches the filename: `# BDR-NNN: Short Title`.
5. Include a `## Status` section containing exactly one of: `Proposed`, `Accepted`, `Rejected`, `Deprecated`, or `Superseded by BDR-NNN`.
6. Include a `## Behavior` section that states, in one sentence, the capability the system provides; do not describe implementation in this section.
7. Include a `## Context` section explaining why this behavior exists and what user need or external constraint it responds to.
8. Include an `## Acceptance Criteria` section listing conditions a black-box observer could confirm without reading the code; do not reference internal classes, specific framework calls, ORM details, or other implementation specifics.
9. Include a `## Verification` section with Given / When / Then scenarios concrete enough to drop directly into a test file.
10. Apply the black-box test before merge: if any acceptance criterion or scenario could not be checked by an external integration test without reading internal source, rewrite it or move that content to an ADR.
11. Phrase the Behavior, Acceptance Criteria, and Verification as falsifiable claims about externally observable system output; do not include subjective qualifiers ("user-friendly", "fast", "robust") without a measurable threshold.
12. Keep each BDR focused on three to five core acceptance criteria; defer non-core questions to follow-up BDRs.
13. Transition the status from `Proposed` to `Accepted` only after independent end-to-end verification of the behavior outside the test harness (for example via `curl`, an observability check, or a manual exercise).
14. Do not edit the `## Behavior`, `## Acceptance Criteria`, or `## Verification` sections of an `Accepted` BDR after merge; if the contract changes, write a new BDR that supersedes it.
15. When superseding an earlier BDR, update that earlier BDR's `## Status` line to `Superseded by BDR-NNN` in the same pull request that introduces the replacement.
16. Reference other BDRs as `BDR-NNN` with a relative markdown link to the BDR file; do not reference BDRs by file path alone or by title.
17. Do not delete `Rejected` BDRs; leave them in place with `Status: Rejected` and a short rationale.
18. Maintain an index file (`README.md` or `index.md`) in the BDR directory listing every BDR by number, title, and current status.
19. Add a "Which BDR does this verify?" prompt to the pull request template so behavior-changing PRs cite the BDR(s) they implement or extend.
