import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 5199);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm run db:migrate:local && pnpm exec vite --port ${port} --strictPort`,
    url: `http://localhost:${port}/api/health`,
    // Never reuse an unknown server on the port (spec: quality/workers-testing.md rule 7).
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
