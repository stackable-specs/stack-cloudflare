# ADR-009: React and Vite frontend

## Status

Accepted

## Context and Problem Statement

The template needs a web frontend that the Worker serves as static assets, with hot reload during local development. [ADR-002](002-local-first-cloudflare-development.md) uses `@cloudflare/vite-plugin`, but no ADR records which UI framework the frontend uses.

## Decision Drivers

- One dev process for the frontend and the Worker.
- Support from the official Cloudflare templates.
- A rules spec in the stackable-specs library (`docs/specs/presentation/react.md`).

## Considered Options

- React with Vite.
- Plain TypeScript with no framework.
- Another component framework (for example, Svelte or Vue) with Vite.

## Decision Outcome

Chosen option: React with Vite, because `create-cloudflare --framework=react` supports it, the Vite plugin runs it in the same process as the Worker, and the library has a React spec.

We will:

- Use React 19 (`react`, `react-dom`) and `@vitejs/plugin-react` in `vite.config.ts`.
- Keep the frontend in `src/client/` with `index.html` at the root.
- Serve the build output from `dist/client` through Workers static assets with `not_found_handling: "single-page-application"`. The Worker runs first only for `/api/*`.
- Call the Worker only through `/api/*` with `fetch`. Do not import Worker code into the frontend.

## Consequences

- Good: React hot reload and the Worker run in one `vite` process.
- Good: Playwright tests use user-facing locators on the React page (`docs/specs/quality/playwright.md`).
- Bad: the client bundle includes React (about 70 kB gzip).
- Neutral: there is no client router or state library. Add one in a new ADR when the UI needs it.

## References

- [ADR-002](002-local-first-cloudflare-development.md)
- `docs/specs/presentation/react.md`
- https://developers.cloudflare.com/workers/vite-plugin/
