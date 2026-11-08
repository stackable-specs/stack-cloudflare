# Behavior Decision Records

Behavior contracts for this stack.
Each BDR captures a single capability the system agrees to uphold,
with acceptance criteria a black-box observer can confirm.

## Index

| BDR                                              | Title                              | Status                                                                                                            |
| ------------------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [BDR-001](001-publish-only-approved-artifact.md) | Publish only the approved artifact | Accepted — reverified 2026-11-07 after the [ADR-006](../adr/006-queue-and-workflow-publication-pipeline.md) fixes |
| [BDR-002](002-health-endpoint.md)                | Health endpoint                    | Accepted                                                                                                          |
| [BDR-003](003-published-artifact-retrieval.md)   | Published artifact retrieval       | Accepted                                                                                                          |
| [BDR-004](004-submission-status-visibility.md)   | Submission status visibility       | Accepted                                                                                                          |
| [BDR-005](005-local-environment-verification.md) | Local environment verification     | Accepted                                                                                                          |

## Authoring

Copy [`000-template.md`](000-template.md), assign the next monotonic number, and open a PR.
