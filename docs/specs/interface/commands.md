---
id: commands
layer: interface
extends: []
---

# Project Command Specification

## Purpose

Every project should expose the same five top-level commands regardless of language, framework, or build system. These commands answer the five fundamental questions every developer has when approaching a new codebase or working day-to-day. By standardizing this interface, we eliminate discovery overhead and create a predictable contract between developer and project. This spec pins the command surface, semantics, and expected outcomes so that anyone can approach any stackable project and immediately know how to work with it.

## Goals

The command surface is deliberately minimal. Five commands cover the complete developer lifecycle:

| Command  | Question                                  |
| -------- | ----------------------------------------- |
| `build`  | Can I prepare the project?                |
| `run`    | Can I use the project?                    |
| `check`  | Is the implementation correct?            |
| `health` | What is the overall state of the project? |
| `clean`  | Can I reset the project?                  |

## References

- **internal** `../practices/command-workflow.md` — How to work with the command interface
- **internal** `../quality/command-verification.md` — How to verify command implementations
- **external** `https://12factor.net/` — The Twelve-Factor App methodology
- **external** `https://www.gnu.org/prep/standards/` — GNU Coding Standards on make targets

---

# build

Produces everything necessary to use the project.

## Purpose

The `build` command is the single entry point for preparing a project. It handles all initialization, dependency resolution, compilation, code generation, and packaging. After `build` succeeds, the project should be ready to run without any additional setup steps.

## Responsibilities

- Install missing dependencies
- Compile source code
- Package artifacts
- Generate code (stubs, schemas, bindings)
- Generate assets (images, fonts, bundles)
- Bootstrap local environment (env files, config templates)
- Cache artifacts for subsequent builds

## Behavior

1. Idempotent: Running `build` multiple times without changes produces the same result.
2. Incremental: Unchanged inputs should not trigger unnecessary work.
3. Self-contained: All prerequisites are fetched or generated; no manual setup required.
4. Deterministic: Same inputs produce equivalent outputs across machines (up to timestamps).

## Exit Codes

| Code | Meaning |
| ---- | ------- |
| 0    | Build succeeded |
| 1    | Build failed |
| 2    | Invalid configuration |
| 3    | Dependency resolution failed |

## Output

On success:
```
Project is ready to run.
```

On failure, output must include:
- What step failed
- Why it failed
- How to fix it (if known)

## Examples

```sh
# Full build
./build

# Build with specific target
./build --target release

# Build with verbose output
./build --verbose
```

## Anti-patterns

1. Requiring manual setup before `build` can run (e.g., "run `setup.sh` first").
2. `build` modifying files outside designated output directories.
3. `build` failing silently or requiring user intervention to continue.
4. `build` taking different actions based on interactive prompts.

---

# run

Starts the project.

## Purpose

The `run` command launches the project in its intended runtime mode. For applications, this starts the server or CLI. For libraries, this may run examples or a REPL. For services, this also starts required local dependencies.

## Responsibilities

- Launch application
- Launch required local services (databases, queues, caches)
- Serve APIs
- Watch files (optional, with `--watch`)
- Hot reload (optional, with `--reload`)

## Behavior

1. Requires successful `build`: If `build` has not been run, `run` must fail with instructions to build first.
2. Environment isolation: Uses configuration and environment variables, not hardcoded values.
3. Graceful shutdown: Handles SIGTERM and SIGINT cleanly, releasing resources.
4. Dependency management: Optionally starts required services (databases, queues) or fails clearly if unavailable.

## Exit Codes

| Code | Meaning |
| ---- | ------- |
| 0    | Clean shutdown (if applicable) |
| 1    | Startup failed |
| 2    | Required service unavailable |
| 3    | Configuration error |
| 130  | Interrupted (SIGINT) |

## Output

On startup:
```
Project is running.
```

Followed by runtime output (logs, request logs, metrics).

## Examples

```sh
# Basic run
./run

# Run with file watching
./run --watch

# Run with hot reload
./run --reload

# Run specific mode
./run --mode development
```

## Anti-patterns

1. Requiring manual service startup (database, redis) before `run`.
2. `run` modifying source files or build outputs.
3. Hardcoded environment-specific values (hosts, ports, credentials).
4. Background processes that cannot be cleanly stopped.

---

# check

Runs deterministic validation.

## Purpose

`check` provides a pass/fail quality gate. It answers "Is the implementation correct?" with binary clarity. Unlike `health`, which provides nuanced assessment, `check` produces a clear verdict: the code either meets its quality standards or it doesn't.

## Responsibilities

Run all deterministic checks:

- Formatting
- Lint
- Type checking
- Unit tests
- Integration tests
- Static analysis
- Security scans
- Build verification

## Behavior

1. Deterministic: Same inputs always produce same result.
2. No interpretation: Output is PASS or FAIL with counts, not prose.
3. Fast feedback: Optimized for developer iteration, not comprehensive audit.
4. Fail-fast: Stop on first category of failures unless `--all` is specified.

## Exit Codes

| Code | Meaning |
| ---- | ------- |
| 0    | All checks passed |
| 1    | One or more checks failed |

## Output

On success:
```
PASS
```

On failure:
```
FAIL

3 lint errors
1 failing test
```

With `--verbose`:
```
FAIL

lint:
  src/auth.py:42:1 - E302 expected 2 blank lines
  src/auth.py:87:5 - E225 missing whitespace around operator
  src/auth.py:112:1 - W291 trailing whitespace

tests:
  FAILED tests/test_auth.py::test_login - AssertionError: expected 200, got 401
```

## Examples

```sh
# Run all checks
./check

# Run specific check category
./check --category lint
./check --category tests
./check --category security

# Run all checks (don't stop at first failure)
./check --all

# Verbose output
./check --verbose
```

## Anti-patterns

1. Non-deterministic checks (flaky tests, timing-dependent assertions).
2. Checks that require external services without mocking.
3. Checks that modify files (auto-fix belongs elsewhere).
4. Checks that require manual steps or user input.

---

# health

Produces a comprehensive assessment of the project.

## Purpose

Unlike `check`, which validates correctness, `health` analyzes the project's condition, trajectory, maintainability, and risk. It answers "How healthy is this project?" with synthesized insights, not just raw metrics.

## Responsibilities

Health gathers metrics across multiple dimensions and synthesizes them into actionable assessment.

## Output Structure

```
Overall: <grade> (<score>/100)

<one-line summary>

Strengths
• <strength 1>
• <strength 2>

Risks
• <risk 1>
• <risk 2>

Recommendations
1. <highest-leverage improvement>
2. <second priority>
3. <third priority>
```

## Dimensions

### Overall

- Overall Health Score (0-100)
- Grade (A/B/C/D/F)
- Risk level (Low/Medium/High/Critical)
- Trend (Improving/Stable/Declining)
- Executive Summary (one sentence)

---

### Size

Measure project scale.

- Total LOC
- Code vs generated code
- Files
- Directories
- Modules
- Packages
- Languages
- Largest modules
- Largest files

---

### Complexity

Measure engineering complexity.

- Cyclomatic complexity
- Cognitive complexity
- Maintainability index
- Average function size
- Largest functions
- Largest classes
- Largest modules
- Deep nesting depth
- God objects
- Complexity hotspots

**Assessment Levels:**
- Low
- Moderate
- High
- Extreme

---

### Architecture

Measure structural integrity.

- Module graph
- Dependency graph
- Circular dependencies
- Layer violations
- Coupling (afferent/efferent)
- Cohesion
- Boundary violations
- Architecture drift
- Dead modules
- Orphan modules

---

### Standards

Detect drift from project conventions.

Examples:
- Naming conventions
- Directory layout
- Package organization
- Layering
- Documentation standards
- API conventions
- Style guide compliance
- Design pattern consistency

**Key Question:** "How far has the project drifted from its intended design?"

---

### Quality

Measure implementation quality.

- Tests passing
- Coverage percentage
- Mutation score
- Lint violations
- Formatting violations
- Static analysis findings
- Type safety percentage
- Build success rate

---

### Dependencies

Measure dependency health.

- Direct dependencies
- Transitive dependencies
- Outdated packages
- Deprecated packages
- Vulnerabilities (CVE count)
- Duplicate libraries
- License issues
- Dependency growth rate

---

### Security

Measure security posture.

- Known vulnerabilities
- Secrets in code
- Unsafe APIs
- Permission issues
- Authentication findings
- Encryption findings
- Security scan results

---

### Performance

Measure engineering performance.

- Build time
- Startup time
- Test duration
- Bundle/binary size
- Memory usage
- Benchmark trends

---

### Documentation

Measure documentation quality.

- Public API coverage
- Missing documentation
- Examples present
- ADR coverage
- Broken links
- Freshness (last updated)

---

### Git

Measure repository health.

#### Working Tree

- Clean/dirty status
- Modified files count
- Untracked files count
- Staged changes count

#### Branch

- Current branch
- Ahead/behind remote
- Merge conflicts
- Stale branches

#### History

- Commit frequency
- Commit size distribution
- Commit message quality
- Revert frequency

#### Churn

- Frequently modified files
- Hotspots
- Ownership concentration

#### Release

- Latest tag
- Version consistency
- Unreleased commits

---

### Runtime

Measure operational readiness.

- Database connectivity (if applicable)
- Required services availability
- Queue health (if applicable)
- Cache health (if applicable)
- External API reachability
- Configuration completeness

---

### Repository

General repository health.

- Repository size
- Large binaries
- Lockfile consistency
- Ignored file issues
- Generated artifacts
- Repository cleanliness

---

### Trends

Measure change over time.

- LOC growth
- Complexity trend
- Coverage trend
- Dependency growth
- Build time trend
- Documentation trend
- Architecture drift
- Standards drift

---

## Subcommands

Health supports targeted queries for individual dimensions:

```sh
./health                # Full executive summary
./health complexity     # Complexity metrics only
./health git            # Git health only
./health trends         # Trend analysis only
./health security       # Security posture only
./health dependencies   # Dependency health only
```

## Exit Codes

| Code | Meaning |
| ---- | ------- |
| 0    | Health assessment completed |
| 1    | Health assessment failed (missing tools, etc.) |

## Anti-patterns

1. Raw metric dumps without synthesis or recommendations.
2. Assessments that require external network access.
3. Long-running assessments (should be fast enough for CI).
4. Assessments that modify project files.

---

# clean

Returns the project to a known clean state.

## Purpose

`clean` resets the project to a pristine state, removing all generated artifacts, caches, and temporary state. After `clean`, running `build` should produce a fresh, reproducible build.

## Responsibilities

- Remove build artifacts
- Remove generated files
- Clear caches (dependency caches, build caches)
- Reset temporary state
- Remove IDE/Editor artifacts (optional, with flag)

## Behavior

1. Complete: Remove all artifacts that `build` creates.
2. Safe: Never remove source files, configuration, or version control data.
3. Idempotent: Running `clean` multiple times produces same result.
4. No prompts: Clean without requiring user confirmation.

## Exit Codes

| Code | Meaning |
| ---- | ------- |
| 0    | Clean succeeded |
| 1    | Clean failed |

## Output

On success:
```
Project is clean.
```

On failure:
```
Clean failed.

Unable to remove: build/locked-file.bin
Reason: File in use by process 12345
```

## Examples

```sh
# Standard clean
./clean

# Deep clean (include caches)
./clean --deep

# Clean including IDE artifacts
./clean --all
```

## Anti-patterns

1. `clean` removing source files or version control history.
2. `clean` requiring user confirmation.
3. `clean` modifying files outside the project directory.
4. `clean` leaving artifacts behind that `build` didn't create.

---

# Extension Guidelines

## Subcommands

Projects may extend commands with domain-specific subcommands:

```sh
# Example extensions
./build --target release
./run --mode production
./check --category security
./health complexity --threshold high
./clean --deep
```

## Return Codes

Standard exit codes enable scripting and CI integration:

| Code Range | Meaning |
| ---------- | ------- |
| 0          | Success |
| 1          | General failure |
| 2          | Configuration error |
| 3          | Dependency error |
| 4-31       | Reserved for future use |
| 32-63      | Application-specific errors |
| 64-127     | Reserved (BSD conventions) |
| 128+       | Signal termination (128 + n) |

## Output Format

Default output is human-readable. Projects should support:

- Plain text (default)
- JSON (`--format json`)
- Machine-parseable (`--quiet` for scripts)

## Command Discovery

Projects implementing this spec should provide:

```sh
# Show available commands
./help

# Show command documentation
./help build
./help run
./help check
./help health
./help clean
```

---

# Verification Checklist

Use this checklist to verify command implementations:

## build

- [ ] Running `build` from clean checkout produces working project
- [ ] Running `build` twice produces same result (idempotent)
- [ ] `build` fails with clear error when prerequisites missing
- [ ] `build` output is captured in version-control-ignored directory
- [ ] `build` succeeds without network access (if dependencies cached)

## run

- [ ] Running `run` after `build` starts the project
- [ ] `run` fails gracefully when `build` not run
- [ ] `run` handles SIGTERM and SIGINT cleanly
- [ ] `run` logs to stdout/stderr, not hidden files
- [ ] `run` respects environment configuration

## check

- [ ] `check` returns 0 on all passing checks
- [ ] `check` returns non-zero on any failing check
- [ ] `check` output clearly shows what failed
- [ ] `check` is deterministic (same result on repeated runs)
- [ ] `check` completes in reasonable time (< 5 minutes for typical project)

## health

- [ ] `health` produces assessment without modifying files
- [ ] `health` includes synthesized recommendations
- [ ] `health` subcommands work for individual dimensions
- [ ] `health` grade/score reflects actual project state
- [ ] `health` identifies actionable improvements

## clean

- [ ] `clean` removes all `build` artifacts
- [ ] `clean` does not remove source files
- [ ] `clean` does not remove version control data
- [ ] `clean` succeeds on already-clean project
- [ ] `build` after `clean` produces working project