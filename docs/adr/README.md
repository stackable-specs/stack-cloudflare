# Architecture Decision Records

This directory records the architecture decisions for this project in MADR format (spec: `docs/specs/practices/madr.md`).

## ADRs in this project

| ID                                                                 | Title                                                   | Status                                      |
| ------------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------- |
| [001](001-five-command-interface-with-make.md)                     | Five-command interface with Make                        | Accepted (extended by ADR-004, ADR-008)     |
| [002](002-local-first-cloudflare-development.md)                   | Local-first Cloudflare development with the Vite plugin | Accepted                                    |
| [003](003-three-environments.md)                                   | Local, hybrid, and staging environments                 | Accepted (corrected by ADR-008)             |
| [004](004-local-setup-and-verification-commands.md)                | Local setup and verification commands                   | Accepted                                    |
| [005](005-dependency-supply-chain-policy.md)                       | Dependency supply-chain policy                          | Accepted                                    |
| [006](006-queue-and-workflow-publication-pipeline.md)              | Queue and Workflow publication pipeline                 | Accepted (items 4 and 6 refined by ADR-010) |
| [007](007-serve-published-artifacts-as-plain-text.md)              | Serve published artifacts as plain text                 | Accepted                                    |
| [008](008-environment-selection-at-build-time.md)                  | Environment selection at build time                     | Accepted                                    |
| [009](009-react-and-vite-frontend.md)                              | React and Vite frontend                                 | Accepted                                    |
| [010](010-dead-letter-consumer-and-local-only-top-level-config.md) | Dead-letter consumer and local-only top-level config    | Accepted                                    |
