---
id: dependency-management
layer: security
extends: []
---

# Dependency Management

## Purpose

Every third-party dependency is code the team ships but did not write, run by the same process and with the same privileges as first-party code; the security posture of the artifact is therefore the union of the posture of every transitive dependency. Without discipline, "it built green" hides the failure modes that matter: a floating version range pulls in a malicious patch release overnight, a missing lockfile means CI and production resolve different graphs, an unpinned base image rebases onto a vulnerable layer, a `git` or URL dependency points at a branch that can be force-pushed, a typosquat package lands in the lockfile because nobody reviewed the diff, and a long-abandoned transitive dependency sits four levels deep with no maintainer to take a CVE report. This spec pins where dependencies may come from, how versions are declared and locked, how new and updated dependencies are reviewed, how often they are refreshed, and how stale or risky ones are retired — so that the dependency graph the team ships is intentional, reproducible, reviewable, and auditable rather than whatever the registry happened to serve when CI last ran. Vulnerability scanning of that graph is governed by the companion `vulnerability-scanning` spec; this spec governs the graph itself.

## References

- **spec** `sbom` — inventory of the dependency graph this spec governs
- **spec** `vulnerability-scanning` — how the graph is scanned and gated
- **external** `https://slsa.dev/` — SLSA supply-chain integrity framework
- **external** `https://docs.github.com/en/code-security/supply-chain-security` — GitHub supply-chain security
- **external** `https://owasp.org/www-project-dependency-check/` — OWASP guidance on dependency hygiene
- **external** `https://docs.npmjs.com/cli/v10/configuring-npm/package-lock-json` — npm lockfile reference
- **external** `https://docs.astral.sh/uv/concepts/projects/locking/` — uv lockfile reference
- **external** `https://docs.renovatebot.com/` — Renovate automated dependency updates
- **external** `https://github.com/dependabot` — Dependabot automated dependency updates

## Rules

1. Declare every direct dependency in a committed manifest file (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, `Gemfile`, etc.); do not install dependencies imperatively at build time without recording them.
2. Commit a lockfile (`package-lock.json`, `pnpm-lock.yaml`, `uv.lock`, `poetry.lock`, `Cargo.lock`, `go.sum`, `Gemfile.lock`) for every project that produces a deployable artifact; do not run a release build from an unlocked dependency graph.
3. Use the lockfile in CI and production builds with a frozen-install flag (`npm ci`, `pnpm install --frozen-lockfile`, `uv sync --frozen`, `cargo build --locked`, `go mod download` with `-mod=readonly`); do not allow the build to mutate the lockfile.
4. Pin every direct dependency to an exact version or a narrow, documented range; do not use unbounded ranges (`*`, `latest`, `>=X`) for direct dependencies in a production project.
5. Resolve dependencies only from a documented, allowlisted set of registries (the public ecosystem registry plus any internal mirror or proxy); do not allow builds to fetch from arbitrary URLs at install time.
6. Configure the package manager with strict registry scoping (npm `@scope:registry`, pip `index-url` / `extra-index-url` ordering, Maven `mirrors`) so internal scopes resolve only to the internal registry; do not let an internal scope name collide with the public registry (dependency-confusion defense).
7. Forbid `git`, URL, file, and tarball dependencies in production manifests; allow them only with a documented exception, a pinned commit SHA (never a branch or tag), and an integrity hash where the package manager supports one.
8. Pin container base images, build images, and language toolchain images by content digest (`@sha256:...`), not by floating tag (`latest`, `bookworm`, `node:20`); do not deploy from a tag-only image reference.
9. Record an integrity hash (subresource-integrity, package-manager-native checksum, or content digest) for every locked dependency the package manager supports it for; do not disable lockfile integrity verification.
10. Review every new direct dependency before it is added — package owner, maintenance signal (release cadence, last commit, open security issues), license, transitive footprint, and whether an existing dependency already covers the need; do not add a new direct dependency on a single contributor's say-so.
11. Restrict the set of contributors who can add or change direct dependencies via CODEOWNERS or an equivalent review rule; do not allow dependency changes to merge without a reviewer who owns dependency policy.
12. Run an automated dependency-update tool (Renovate, Dependabot, or equivalent) against every repository on a recurring schedule; do not rely on humans to remember to refresh dependencies.
13. Group routine non-security updates into batched pull requests (e.g. weekly) and route security updates as standalone pull requests with an SLA defined by the `vulnerability-scanning` spec; do not bundle a security patch into a weekly grab-bag PR.
14. Treat every dependency-update pull request as code: it must pass the full CI suite (lint, typecheck, unit, integration, security scan, license check); do not merge dependency updates that skip any gate that applies to first-party code.
15. Maintain an allowlist of acceptable open-source licenses and fail CI on any dependency whose declared license is outside the allowlist or unknown; do not silently ship a dependency with a forbidden or unresolved license.
16. Identify and remove unused dependencies on a recurring schedule with a tool appropriate to the ecosystem (`depcheck`, `knip`, `unimport`, `cargo-udeps`, `go mod tidy`); do not leave declared dependencies that nothing imports.
17. Retire dependencies that have been unmaintained for a documented threshold (no release within a documented window, archived upstream, abandoned by a sole maintainer) by replacing, vendoring, or forking them; do not ship a production artifact with a dependency upstream has visibly abandoned.
18. Cache or mirror third-party dependencies through an internal proxy / artifact repository (Artifactory, Nexus, Verdaccio, GitHub Packages) used by CI and production builds; do not let a release build depend on the public registry being reachable and unmodified at build time.
19. Record provenance for every internally produced and republished dependency (SLSA attestation, signed package, or in-toto statement); do not republish a dependency to the internal mirror without provenance.
20. Document the dependency policy (allowed registries, license allowlist, update cadence, exception process, contact owner) in the repository or a linked policy doc; do not enforce dependency rules only as tribal knowledge.
