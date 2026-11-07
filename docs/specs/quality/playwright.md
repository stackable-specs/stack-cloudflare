---
id: playwright
layer: quality
extends: []
---

# Playwright

## Purpose

Playwright is a browser automation framework for end-to-end testing across Chromium, Firefox, and WebKit. Without shared conventions, teams write brittle tests tied to CSS classes and DOM structure, introduce hidden test-to-test dependencies through shared state, and manually wait for conditions that Playwright's auto-waiting already handles — producing suites that are slow, flaky, and costly to maintain. This spec establishes the rules that keep Playwright suites stable, independent, and actionable on failure.

## Do

- Locate elements through user-facing attributes: `getByRole()`, `getByLabel()`, `getByText()`, `getByTestId()`.
- Use web-first assertions (`toBeVisible()`, `toHaveText()`) that auto-retry until the condition is met.
- Keep every test fully isolated: dedicated browser context, no shared authentication or storage state between tests.
- Collect traces on first retry and use Trace Viewer for CI failure diagnostics.
- Set `forbidOnly: !!process.env.CI` to prevent accidental `test.only` markers blocking the build.

## Don't

- Use CSS class selectors or XPath to locate elements.
- Call `page.waitForTimeout()` or any fixed sleep — rely on auto-waiting instead.
- Write assertions as `expect(await locator.isVisible()).toBe(true)` — that pattern doesn't retry.
- Test against external third-party services; mock them with `page.route()`.
- Leave `test.only` in committed code.

## References

- **external** `https://playwright.dev/docs/best-practices` — Official Playwright best practices guide
- **external** `https://playwright.dev/docs/test-configuration` — playwright.config.ts reference

## Rules

1. Locate elements using Playwright's user-facing locator methods (`getByRole()`, `getByLabel()`, `getByText()`, `getByPlaceholder()`, `getByTestId()`) — do not use CSS class selectors or XPath. (refs: https://playwright.dev/docs/best-practices)
2. Write assertions using web-first assertion methods (`toBeVisible()`, `toHaveText()`, `toHaveValue()`, etc.) that auto-retry; do not assert by manually awaiting a boolean method and comparing with `toBe(true/false)`.
3. Never call `page.waitForTimeout()` or any fixed-duration sleep; rely on Playwright's built-in auto-waiting and web-first assertions to synchronize with the application.
4. Give every test its own browser context with fresh storage, cookies, and session state; do not share state between tests.
5. Set `retries: process.env.CI ? 2 : 0` in `playwright.config.ts` so tests retry on CI but fail fast locally.
6. Set `trace: 'on-first-retry'` so traces are captured on the first failed retry without adding overhead to passing runs.
7. Set `forbidOnly: !!process.env.CI` in `playwright.config.ts` to prevent `test.only` from being committed and blocking the CI build.
8. Define the application URL as `baseURL` in `playwright.config.ts` and use relative paths in `page.goto()` calls; do not hardcode full URLs in individual tests.
9. Use `page.route()` to intercept and mock requests to external services; do not let tests depend on third-party APIs or services outside your control.
10. Use the `projects` array in `playwright.config.ts` to declare the browsers under test; on CI, install only those browsers with `npx playwright install --with-deps <browser>`.
11. Extract repeated multi-step interactions into Page Object classes; do not duplicate locator queries and interaction sequences across test files.
