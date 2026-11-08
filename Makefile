# stack-base command interface (spec: docs/specs/interface/commands.md).
# Each target wraps a pnpm script, so CI and developers use the same commands.

.DEFAULT_GOAL := help
.PHONY: help build run check health clean e2e verify migrate seed deploy-stage setup doctor verify-local

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*## "}; /^[a-zA-Z_-]+:.*## / {printf "  make %-14s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Install dependencies, generate types, apply local D1 migrations, and build
	pnpm install --frozen-lockfile
	pnpm run cf-typegen
	pnpm run db:migrate:local
	pnpm run build
	@echo "Project is ready to run."

run: ## Start Vite and the local Worker (D1, R2, Queues, Workflows in workerd)
	@test -d node_modules || { echo "Run 'make build' first."; exit 1; }
	pnpm run db:migrate:local
	pnpm run dev

check: ## Run format, lint, type, unit, and Worker checks (PASS or FAIL)
	@node scripts/check.mjs $(ARGS)

health: ## Print a synthesized project health assessment
	@node scripts/health.mjs

clean: ## Remove build output, test output, and local Cloudflare state
	rm -rf dist coverage playwright-report test-results node_modules/.tmp node_modules/.vite
	@if [ "$(DEEP)" = "1" ]; then rm -rf .wrangler node_modules; echo "Deep clean: removed .wrangler and node_modules."; fi
	@echo "Project is clean."

# Extensions (spec: commands.md "Extension Guidelines").

e2e: ## Run Playwright end-to-end tests against the local dev server
	pnpm run test:e2e

verify: ## Run post-deploy smoke checks against BASE_URL (default http://localhost:5173)
	pnpm run verify

migrate: ## Apply D1 migrations to the local database
	pnpm run db:migrate:local

seed: ## Upload the fixture artifact into local R2
	pnpm run seed:local

setup: ## First-time setup: install, types, local migrations, Chromium, .dev.vars (never overwritten), doctor
	pnpm install --frozen-lockfile
	pnpm run cf-typegen
	pnpm run db:migrate:local
	pnpm exec playwright install chromium
	@test -f .dev.vars || { cp .dev.vars.example .dev.vars; echo "Created .dev.vars from .dev.vars.example."; }
	@node scripts/doctor.mjs

doctor: ## Check local prerequisites: Node.js, pnpm, dependencies, Chromium, .dev.vars, ports (PASS or FAIL)
	@node scripts/doctor.mjs

verify-local: ## Start the dev server on a free port, prove D1/R2/Queues/Workflows/Local Explorer, stop (PASS or FAIL)
	@node scripts/verify-local.mjs

deploy-stage: ## Build and deploy to the staging environment
	pnpm run deploy:stage
