---
id: madr
layer: practices
extends: []
---

# Markdown Any Decision Records (MADR)

## Purpose

Decisions made in chat, meetings, or inline comments evaporate. Six months later a new contributor cannot tell why the service chose Postgres over DynamoDB, whether the call was deliberate or expedient, or what forces drove it — so the team re-debates, re-decides, or silently drifts. MADR captures architectural decisions as a numbered sequence of short markdown documents stored next to the code, reviewed through the same PR mechanism as the code itself, with a fixed section layout so a reader can scan Context / Options / Decision / Consequences in seconds. This spec pins the file location, numbering, required sections, and supersession workflow so the ADR log stays a reliable explanation of *why the code is the way it is* rather than a pile of informal notes, and so the `ADR-###` references used throughout this repo's specs resolve to documents that actually exist and conform.

## References

- **external** `https://github.com/adr/madr` — MADR (Markdown Any Decision Records) repository
- **external** `https://adr.github.io/madr/` — MADR documentation and templates
- **external** `https://adr.github.io/` — ADR community site
- **external** `https://github.com/adr/madr/tree/main/template` — MADR template files
- **external** `https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions` — Michael Nygard's original ADR post

## Rules

1. Store ADRs in a single directory (commonly `docs/adr/` or `adr/` at the repo root) and document its location in the repository README.
2. Name each ADR file `NNN-short-title.md`, where `NNN` is a three-digit zero-padded sequence number and the title is kebab-case.
3. Assign sequence numbers monotonically; do not reuse a retired number or rewrite history to re-number merged ADRs.
4. Begin every ADR with a level-1 heading that matches the filename: `# ADR-NNN: Short Title`.
5. Include a `## Status` section containing exactly one of: `Proposed`, `Accepted`, `Rejected`, `Deprecated`, or `Superseded by ADR-NNN`.
6. Include a `## Context and Problem Statement` section describing the forces at play and the problem the decision must resolve.
7. Include a `## Considered Options` section listing every option seriously evaluated, one bullet per option.
8. Include a `## Decision Outcome` section naming the chosen option and summarizing the primary reason for the choice.
9. Include a `## Consequences` section describing the positive, negative, and neutral impacts that result from the decision.
10. Include a `## Decision Drivers` section when specific forces (cost, latency, compliance, staffing, vendor lock-in, etc.) materially shaped the outcome.
11. Include a `## Pros and Cons of the Options` section when three or more candidate options were considered with non-obvious trade-offs.
12. Write the decision in the form "We will …" once the status is `Accepted`; `Proposed` drafts may phrase the decision as a recommendation.
13. Do not edit the body of an `Accepted` ADR after it merges; capture new information in a new ADR.
14. When superseding an earlier ADR, update that earlier ADR's `## Status` line to `Superseded by ADR-NNN` in the same pull request that introduces the replacement.
15. Reference other ADRs as `ADR-NNN` with a relative markdown link to the ADR file; do not reference ADRs by file path alone or by title.
16. Propose ADRs via a pull request and treat the PR review as the debate-and-approval mechanism; do not commit ADRs directly to the default branch.
17. Do not delete `Rejected` ADRs; leave them in place with `Status: Rejected` and a short rationale so future readers can see what was considered and declined.
18. Maintain an index file (`README.md` or `index.md`) in the ADR directory listing every ADR by number, title, and current status.
