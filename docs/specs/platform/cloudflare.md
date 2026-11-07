---
id: cloudflare
layer: platform
extends: []
---

# Cloudflare

## Purpose

Cloudflare is a global-edge platform whose default settings prioritize "this works in the dashboard" over "this is safe on the public internet." A fresh zone will happily resolve A records straight to an origin IP that anyone can `nmap`, accept "Flexible SSL" (plaintext to origin), default the minimum TLS version to a deprecated protocol, leave DNSSEC off, and let `wrangler.toml` `vars` ship a database password into a Worker bundle. A user who logged in once with email + password and never enabled 2FA has the same blast radius as one with hardware-backed SSO. R2 buckets created in the dashboard default to public-bucket-equivalent semantics if a developer toggles `r2.dev` access without thinking. Without Tunnels or Authenticated Origin Pulls, the entire "we use Cloudflare" story collapses the moment someone resolves the origin out-of-band. Without WAF, bot management, and rate limiting on credential endpoints, the proxy is a CDN with no security plane. This spec pins the cross-product Cloudflare baseline — IaC-managed zones and Workers, scoped API tokens (no Global Keys), 2FA + SSO, DNSSEC, "Full (strict)" TLS with TLS 1.2+, HSTS, "Always Use HTTPS," origin-only-via-Tunnel/AOP, proxied DNS, the WAF managed ruleset, bot management, rate limiting on credential endpoints, secrets out of `wrangler.toml`, pinned Worker `compatibility_date`, private R2 by default, audit-log + HTTP-log export, and Cloudflare Access for internal tools — so individual product specs (Workers, R2, Pages, D1, Zero Trust) can refine on top of a known floor.

## References

- **spec** `opentofu` — IaC layer used to manage Cloudflare via the official Terraform/OpenTofu provider
- **external** `https://www.cloudflare.com/` — Cloudflare home
- **external** `https://developers.cloudflare.com/` — Cloudflare Developer Docs
- **external** `https://developers.cloudflare.com/fundamentals/api/get-started/create-token/` — Scoped API tokens
- **external** `https://developers.cloudflare.com/dns/dnssec/` — DNSSEC
- **external** `https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/` — SSL/TLS Full (strict) mode
- **external** `https://developers.cloudflare.com/ssl/edge-certificates/additional-options/http-strict-transport-security/` — HSTS
- **external** `https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/` — Cloudflare Tunnel (`cloudflared`)
- **external** `https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/` — Authenticated Origin Pulls (mTLS)
- **external** `https://developers.cloudflare.com/waf/` — Web Application Firewall
- **external** `https://developers.cloudflare.com/bots/` — Bot Management / Super Bot Fight Mode
- **external** `https://developers.cloudflare.com/waf/rate-limiting-rules/` — Rate-limiting rules
- **external** `https://developers.cloudflare.com/workers/wrangler/configuration/` — Wrangler config (`wrangler.toml`)
- **external** `https://developers.cloudflare.com/r2/api/s3/api/` — R2 access controls
- **external** `https://developers.cloudflare.com/logs/logpush/` — Logpush
- **external** `https://developers.cloudflare.com/cloudflare-one/policies/access/` — Cloudflare Access

## Rules

1. Manage Cloudflare resources (zones, DNS records, Workers, R2 buckets, WAF rules, Access policies) via Infrastructure as Code — the official Terraform/OpenTofu Cloudflare provider, or `wrangler.toml` for Workers and Pages — and apply changes from CI; do not configure production resources from the dashboard. (refs: opentofu)
2. Use a separate Cloudflare account per organizational boundary (production org vs staging vs personal sandboxes); do not commingle production zones with personal projects in a single account.
3. Authenticate API access via scoped API Tokens with explicit zone/account/permission scopes, sourced from a secret manager and rotated on a documented schedule; do not use the legacy Global API Key for automation.
4. Require 2FA on every Cloudflare user account and use SSO (SAML/OIDC) for organizational logins where the plan supports it; do not rely on email + password alone.
5. Enable DNSSEC on every production zone and publish the DS record at the registrar; do not run a production zone with DNSSEC disabled when the registrar supports it.
6. Set the SSL/TLS encryption mode to "Full (strict)" on every production zone so Cloudflare validates the origin certificate; do not run "Flexible" or "Full" (non-strict) modes.
7. Enable "Always Use HTTPS" and "Automatic HTTPS Rewrites" on every production zone; do not allow plaintext HTTP traffic to reach the origin.
8. Enable HSTS with `max-age >= 31536000`, `includeSubDomains`, and (after validation) `preload` on every production zone.
9. Set the minimum TLS version to 1.2 (preferably 1.3) on every production zone; do not accept TLS 1.0 or 1.1.
10. Reach origins via Cloudflare Tunnels (`cloudflared`) or Authenticated Origin Pulls (mTLS); do not expose origin hostnames or IPs as publicly resolvable A/AAAA records that bypass the Cloudflare proxy.
11. Mark every public-facing DNS record (A, AAAA, CNAME) on a Cloudflare-protected zone as "proxied" (orange cloud); reserve "DNS-only" (gray cloud) for records that cannot be proxied (e.g. SMTP MX targets) and document each exception.
12. Enable the Cloudflare WAF managed ruleset (Cloudflare Managed Ruleset + OWASP Core Ruleset, or the team's documented equivalent) on every production zone; do not disable a managed ruleset to silence a finding — write a narrowly scoped exception rule instead.
13. Enable Cloudflare Bot Management (or Super Bot Fight Mode on non-Enterprise plans) on every public production zone; do not ship a public-facing service with no bot mitigation.
14. Configure rate-limiting rules per route on login, signup, password-reset, OTP, and write-heavy API endpoints; do not run a production zone with no rate-limiting on credential-bearing endpoints.
15. Manage Workers and Pages via committed `wrangler.toml` (or `wrangler.jsonc`) and deploy from CI; do not `wrangler deploy` from a developer laptop to a production environment.
16. Bind Worker secrets via `wrangler secret put` or the Workers Secret Store (sourced from an external secret manager where the plan supports it); do not place secrets in `wrangler.toml` `vars`, in `.dev.vars` files committed to git, or in CI variables visible in build logs.
17. Pin every Worker's `compatibility_date` and required `compatibility_flags` in `wrangler.toml`; do not leave `compatibility_date` floating between deploys.
18. Keep R2 buckets private by default and serve public objects via a Worker or short-lived signed URL; reserve `r2.dev` public access for non-production data and document any exception.
19. Export account audit logs (via Logpush or the Audit Logs API) to a centralized log store and review changes to DNS, WAF, Access policies, and Tunnels on a documented cadence; do not operate a production account without audit-log export.
20. Configure Logpush for HTTP request logs, Workers Trace logs, and Zero Trust logs to the team's central log store; do not rely on the in-dashboard log viewer as the only source of operational data.
21. Gate access to internal applications (admin panels, dev environments, internal APIs) with Cloudflare Access policies bound to the organization's SSO identity provider; do not expose internal applications on a public hostname behind nothing more than IP allowlists.
