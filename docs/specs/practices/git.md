---
id: git
layer: practices
extends: []
---

# Git

## Purpose

Git is the substrate every other practice in this layer relies on — Conventional Commits parses messages git stores, MADR / BDR ride PR review, TDD's "commit at green" only means anything if the history shows it. When the team has no shared rules for branch model, merge strategy, signing, force-push, tags, large-file handling, or hook installation, every other practice silently degrades: a force-push to `main` rewrites the audit trail Conventional-Commits-driven release tooling depends on, a `merge` of a feature branch with twenty WIP commits buries the parse-able commits behind unparseable ones, an unsigned tag means a release has no provenance, a binary committed straight to history bloats every clone forever, and a contributor who skipped the hook install bypasses the local lint gate the rest of the team is paying for. This spec pins the branch model, branch and tag naming, merge strategy, signing, force-push and rewrite policy, hook ownership, large-file handling, submodule policy, identity, and recovery workflow — so the git history is a reliable, signed, machine-readable record of what shipped, not a pile of tribal habits whose state on `main` depends on which contributor pushed last.

## References

- **spec** `conventional-commits` — sibling practices spec governing the *format* of commit messages git stores
- **spec** `madr` — sibling practices spec; ADRs are introduced via the same PR mechanism this spec governs
- **spec** `bdr` — sibling practices spec; BDRs are introduced via the same PR mechanism this spec governs
- **external** `https://git-scm.com/doc` — Git documentation
- **external** `https://trunkbaseddevelopment.com/` — Trunk-based development
- **external** `https://semver.org/` — Semantic Versioning 2.0.0 (consumed by tagging rules)
- **external** `https://docs.github.com/en/authentication/managing-commit-signature-verification` — GitHub commit signature verification
- **external** `https://www.git-scm.com/docs/gitattributes` — `gitattributes`
- **external** `https://git-lfs.com/` — Git LFS

## Rules

1. Name the default branch `main`; do not use `master` for new repositories and migrate existing repositories on a documented schedule.
2. Adopt trunk-based development with short-lived branches (typically merged within a few days); do not maintain long-lived feature, integration, or per-environment branches as the working model.
3. Branch from `main` and rename the branch with a Conventional-Commits-aligned prefix matching the work — `feat/<topic>`, `fix/<topic>`, `chore/<topic>`, `docs/<topic>`, etc.; do not push branches named `wip`, `tmp`, or after a contributor's name only. (refs: conventional-commits)
4. Pick exactly one merge strategy per repository — squash-merge or rebase-merge — and configure the forge to forbid the others; do not allow per-PR strategy choice.
5. Enforce a linear history on `main` via a forge protected-branch rule; do not allow merge commits on `main` outside that strategy.
6. Land every change to `main` through a pull request reviewed by at least one approver who is not the author; do not push to `main` directly except via approved release automation that is itself code-reviewed.
7. Squash a PR's commits into a single Conventional-Commits-conformant commit on merge, or — if rebase-merge is the chosen strategy — ensure every retained commit individually conforms; do not merge a series of WIP commits onto `main`. (refs: conventional-commits)
8. Sign every commit and tag (GPG, SSH, or Sigstore / `gitsign`) and require the forge to verify the signature on `main`; do not accept unsigned commits on the default branch.
9. Set `pull.rebase = true` (or use `git pull --rebase`) for routine updates from `main`; do not generate `Merge branch 'main' into <feature>` commits in feature branches.
10. Force-push (`git push --force` / `--force-with-lease`) only to personal, unreviewed feature branches you own; do not force-push to `main`, to shared branches, or to a feature branch others have based work on.
11. Use `git push --force-with-lease` (never bare `--force`) when a force-push is permitted; do not use bare `--force` even on personal branches.
12. Revert merged changes with `git revert` and a Conventional-Commits-formatted `revert:` commit referencing the original SHA; do not "remove" merged changes by force-pushing or amending history. (refs: conventional-commits)
13. Tag releases as annotated, signed tags (`git tag -s`) following the project's SemVer scheme — typically `vMAJOR.MINOR.PATCH`; do not use lightweight tags for releases.
14. Treat tags as immutable; do not delete or move a tag once it has been pushed and consumed by any release tooling, image, or downstream artifact.
15. Commit a `.gitignore` at the repository root covering build outputs, virtualenvs, editor state, OS-specific cruft, and any local secret material; do not rely on contributors to maintain personal `.gitignore` files for shared paths.
16. Commit a `.gitattributes` declaring line-ending normalization (`* text=auto`), language-specific diff drivers (e.g. `*.go diff=golang`), and any export-ignore patterns; do not rely on each contributor's `core.autocrlf` setting.
17. Commit binaries that exceed the project's documented size threshold via Git LFS (or an equivalent out-of-tree store), tracked through `.gitattributes`; do not commit large binaries directly to ordinary git history.
18. Forbid `git submodule` by default; allow submodules only with an accepted ADR, a pinned commit SHA (never a branch ref), and documentation in the README explaining the dependency. (refs: madr)
19. Manage git hooks declaratively through a hook manager (`pre-commit`, `lefthook`, `husky`, `prek`, etc.) checked into the repository; do not rely on contributors to install hooks by hand.
20. Install the project's hook manager as part of the documented onboarding command (e.g. `make install`, `bootstrap.sh`); do not let a contributor work in the repository without the hooks active.
21. Configure `user.name` and `user.email` to a real identity tied to the contributor's forge account in every clone (per-repo or per-host); do not commit as `root@…`, an empty name, or a shared mailbox.
22. Configure `commit.gpgsign = true` (or the SSH/Sigstore equivalent) per-repo or globally so signatures cannot be omitted by accident.
23. Treat the forge's default branch protection ruleset as code: store the ruleset in repository config (Terraform, the forge's API, or a committed YAML the forge consumes) and review changes via PR; do not rely on hand-toggled UI settings.
24. Set a single canonical `origin` remote for every clone; do not push the same branch to multiple remotes without an ADR documenting the mirroring topology.
25. Configure `core.hooksPath` to the hook-manager-managed directory or accept the hook manager's default; do not commit ad-hoc scripts under `.git/hooks/` (which is per-clone and not shared).
26. Run `git gc --auto` (or the forge's equivalent housekeeping) on a documented cadence in repositories with large or long-lived histories; do not let the pack indices degrade silently.
27. Do not bypass commit-msg, pre-commit, or pre-push hooks with `--no-verify`; fix the underlying finding or update the hook configuration deliberately.
28. Pair-program credit goes in `Co-authored-by:` trailers on the commit, one trailer per co-author; do not bury collaborators in body prose. (refs: conventional-commits)
29. Configure `.git-blame-ignore-revs` for whole-repo formatting or rename commits and point the forge at it; do not let mass-formatting commits poison `git blame`.
