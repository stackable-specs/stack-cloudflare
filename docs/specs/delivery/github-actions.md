---
id: github-actions
layer: delivery
extends: []
---

# GitHub Actions

## Purpose

GitHub Actions is the CI/CD substrate that decides what code reaches main, what artifacts get published, and what credentials a workflow may exercise — so a sloppy workflow is a supply-chain, secret-leak, and budget liability rolled into one. Unpinned third-party actions invite tag-rewrite attacks, default `GITHUB_TOKEN` write permissions enlarge the blast radius of any compromised step, missing concurrency lets a slower deploy clobber a newer one, missing timeouts burn minutes on stuck jobs, and unscoped `pull_request_target` workflows hand secrets to forks. This spec pins how workflows are structured (location, naming, triggers), how they are authenticated (least-privilege `permissions`, OIDC over long-lived secrets), how they handle untrusted input, and how runners and environments are scoped, so "the build passed" is a meaningful gate rather than an attestation that nothing exploded yet.

## References

- **external** `https://docs.github.com/en/actions` — GitHub Actions documentation
- **external** `https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions` — Security hardening guide
- **external** `https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions` — Workflow syntax reference
- **external** `https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect` — OIDC for cloud deployments
- **external** `https://docs.github.com/en/actions/using-jobs/using-environments-for-deployment` — Deployment environments and protection rules
- **external** `https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions#using-third-party-actions` — Third-party action pinning guidance
- **external** `https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication#permissions-for-the-github_token` — `GITHUB_TOKEN` permissions reference
- **external** `https://securitylab.github.com/resources/github-actions-untrusted-input/` — Script injection via untrusted input

## Rules

1. Define every workflow as a YAML file under `.github/workflows/`; do not store reusable CI logic outside that directory.
2. Set a top-level `name:` on every workflow so runs are identifiable in the Actions UI, status checks, and notifications.
3. Pin every third-party action (`uses: <owner>/<repo>@<ref>`) to a full-length 40-character commit SHA with the version as a trailing comment (e.g. `@<sha> # v4.2.2`); do not reference third-party actions by branch, floating tag, or major-version alias.
4. Pin GitHub-owned actions (`actions/*`, `github/*`) to a specific major-version tag at minimum (e.g. `actions/checkout@v4`); do not reference them by branch.
5. Declare `permissions:` explicitly at the workflow or job level, starting from `contents: read`, and grant additional scopes only for jobs that need them; do not rely on the repository's default `GITHUB_TOKEN` permissions.
6. Declare a `concurrency:` group on workflows that race for the same target (deploys, release publishes, environment promotions) so newer runs cancel or queue older runs.
7. Set an explicit `timeout-minutes:` on every job; do not rely on GitHub's default 360-minute job timeout.
8. Declare every trigger that runs a workflow under `on:` with the specific events the workflow requires; do not use `on: [push, pull_request]` shorthand when only one event is needed.
9. Reference secrets via `${{ secrets.<NAME> }}` only within the steps that need them; do not echo secrets to workflow output and do not pass them as command-line arguments where they would appear in process listings.
10. Authenticate to cloud providers and package registries via OIDC (`permissions: id-token: write` plus the provider's federated trust) for production credentials; do not store long-lived cloud or registry credentials as repository or organization secrets when an OIDC integration exists.
11. Pass PR-controlled input (issue titles, PR bodies, branch names, commit messages, `github.event.*` fields) through intermediate `env:` variables and reference the variables from `run:` blocks; do not interpolate `${{ github.event.* }}` values directly inside `run:` shell scripts.
12. Run public-repository workflows on GitHub-hosted runners; do not attach self-hosted runners to public repositories.
13. Use ephemeral, just-in-time self-hosted runners for private-repo workloads that require them; do not reuse a persistent self-hosted runner across unrelated repositories.
14. Cache language and toolchain dependencies through the official `setup-*` actions' built-in cache or `actions/cache` keyed on the project's lockfile; do not implement ad-hoc caching that ignores lockfile changes.
15. Gate deployments behind a GitHub `environment:` with required reviewers and environment-scoped secrets; do not target production from a workflow that has no `environment:` declaration.
16. In `pull_request_target` workflows, do not both check out the PR author's commit (`ref: github.event.pull_request.head.sha`) and grant write permissions or read repository secrets in the same job.
17. Pass `persist-credentials: false` to `actions/checkout` for jobs that do not push back to the repository, so subsequent steps cannot reuse the workflow's `GITHUB_TOKEN`.
