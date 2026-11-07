---
id: conventional-commits
layer: practices
extends: []
---

# Conventional Commits

## Purpose

A Conventional Commits message is the smallest piece of metadata a team can attach to a change that lets every downstream tool — release-notes generators, SemVer-bumping release bots, changelog renderers, monorepo task graphs, scope-filtered CI, and `git log --grep` — make correct decisions without a human re-reading the diff. Adopted halfway, the format produces noise: `Fixed bug` lands next to `feat: add auth`, breaking changes ship as `chore`, release-please picks the wrong version, the changelog says "0 user-facing changes" the day a major shipped, and `git bisect` cannot tell a refactor from a behavior change. The discipline is only valuable when every commit on the default branch parses, when `feat:` actually means user-visible behavior, when breaking changes always carry `!` and a `BREAKING CHANGE:` footer, and when CI gates the format so violations cannot land. This spec pins the structural format, the type vocabulary, the breaking-change signaling, the body and footer rules, and the local + CI enforcement, so the commit log is a machine-readable contract that a release tool can drive.

## References

- **spec** `madr` — practices-layer ADR format that pairs with Conventional Commits for change history
- **spec** `openapi` — interface-layer SemVer-version rules consumed by Conventional-Commits-driven release tooling
- **external** `https://www.conventionalcommits.org/en/v1.0.0/` — Conventional Commits 1.0.0 specification
- **external** `https://semver.org/` — Semantic Versioning 2.0.0
- **external** `https://github.com/conventional-changelog/commitlint` — commitlint
- **external** `https://github.com/conventional-changelog/commitlint/tree/master/%40commitlint/config-conventional` — `@commitlint/config-conventional` ruleset
- **external** `https://github.com/googleapis/release-please` — release-please
- **external** `https://github.com/changesets/changesets` — Changesets
- **external** `https://github.com/semantic-release/semantic-release` — semantic-release
- **external** `https://git-cliff.org/` — git-cliff (changelog generator)

## Rules

1. Format every commit subject as `<type>[optional scope][!]: <description>` per Conventional Commits 1.0.0.
2. Use only the agreed type vocabulary — `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`; do not invent new types without updating the project's commitlint allowlist.
3. Write the type and scope in lowercase; do not capitalize the type (`Feat:`, `Fix:`).
4. Keep the subject line under 72 characters so it survives GitHub / GitLab PR-title truncation and `git log --oneline` rendering.
5. Write the description in the imperative mood ("add", "fix", "remove"); do not use past tense ("added", "fixed") or third person ("adds", "fixes").
6. Do not end the subject with a period.
7. Place an optional scope in parentheses immediately after the type and before the colon (e.g. `feat(auth): …`); name the scope after a stable codebase area (package, module, subsystem) listed in the project's commitlint config.
8. Mark a breaking change with `!` immediately before the colon (e.g. `feat(api)!: …`) and include a `BREAKING CHANGE:` footer describing the impact and migration; do not ship a breaking change with only the `!` and no footer.
9. Write the literal token `BREAKING CHANGE` (or `BREAKING-CHANGE`) in uppercase in the footer; do not lowercase it.
10. Bump the package's major version for every commit that contains `!` or a `BREAKING CHANGE:` footer; do not ship a breaking change in a minor or patch release. (refs: openapi)
11. Use `feat:` only for new user-visible behavior that maps to a SemVer minor bump; do not use `feat:` for refactors, internal cleanups, dependency bumps, or test additions.
12. Use `fix:` only for changes that correct a defect in shipped behavior; do not use `fix:` for cosmetic changes, test fixes, or documentation corrections.
13. Use `docs:` for documentation-only changes, `test:` for test-only changes, `refactor:` for behavior-preserving code changes, `perf:` for performance-only improvements, `chore:` for tooling and maintenance, `build:` for build-system changes, and `ci:` for CI-config changes.
14. Separate the body and footers from the subject with a blank line each; do not run the body directly under the subject.
15. Wrap the body at a fixed column (commonly 72 or 100) consistent with the project's editor config; do not write paragraphs as single long lines.
16. Format footers as `<Token>: <value>` (or `<Token> #<value>` for issue links) — for example `Refs: ABC-123`, `Reviewed-by: …`, `Co-authored-by: …`; do not interleave free-form prose with footer tokens.
17. Reference the original commit(s) in the footer of `revert:` commits (`Refs: <SHA>`); do not use `revert:` without a reference to the commit being reverted.
18. Enforce the format in CI with commitlint (`@commitlint/config-conventional`) or an equivalent linter against every commit on a PR; treat lint failures as build failures.
19. Run the commit linter as a local `commit-msg` hook (Husky, Lefthook, pre-commit, or equivalent) so violations are caught before push.
20. Generate release notes and changelogs from the commit log via a Conventional-Commits-aware tool (release-please, Changesets, semantic-release, git-cliff); do not maintain a hand-edited `CHANGELOG.md` that duplicates the commit history.
21. Land each PR with a squash-merged Conventional Commit subject (or, if using rebase-merge, ensure every retained commit individually conforms); do not let a PR merge a series of WIP commits that would fail commitlint if read individually.
