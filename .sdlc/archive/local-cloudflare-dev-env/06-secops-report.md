# SecOps Report — local-cloudflare-dev-env

Target: /Users/owenzanzal/pai/src/stack-cloudflare. Date: 2026-11-07. Mode: tools run inline (no subagents, per the gate instruction).

## Project profile

TypeScript Cloudflare Worker template (Vite, Wrangler, pnpm). No Dockerfile. No IaC. No Kubernetes manifests (ADR-002). Groups 4-7 are not active.

## Tool results

| Group | Tool | Result |
|-------|------|--------|
| 1 Secrets | gitleaks dir . | no leaks |
| 1 Secrets | gitleaks git . | no leaks |
| 2 SAST | semgrep p/javascript, p/typescript, p/secrets (scripts, worker, src, tests) | 0 results |
| 3 SCA | osv-scanner (pnpm-lock.yaml, 305 packages) | 1 Medium: GHSA-g3hv-75wg-m249 minimatch 10.2.6 (fix 11.0.1) |
| 3 SCA / misc | trivy fs vuln,misconfig,secret HIGH/CRITICAL | 0 |

## Consolidated findings

| # | Severity (tool) | Severity (context) | Finding | Note |
|---|-----------------|--------------------|---------|------|
| S1 | Medium | Low | minimatch 10.2.6 (GHSA-g3hv-75wg-m249) | Pre-existing. pnpm-lock.yaml is unchanged by this run. Dev-only transitive dependency of eslint. Not in the Worker bundle. Follow-up. |

## Changes Since Last Scan

No previous scan. All findings are new to this report.
