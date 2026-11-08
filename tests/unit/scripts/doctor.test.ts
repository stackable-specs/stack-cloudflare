import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { afterAll, describe, expect, it } from "vitest";
import { chromiumState, evaluateDoctor, gatherFacts } from "../../../scripts/doctor.mjs";
import { formatResult } from "../../../scripts/lib/local-dev.mjs";

const healthy = {
  nodeVersion: "22.11.0",
  pnpmVersion: "11.19.0",
  hasModules: true,
  hasTypes: true,
  chromium: "ok",
  hasDevVars: true,
  hasD1State: true,
  port5173Free: true,
  verifyStart: 5199,
  verifyPort: 5199,
};

const lines = (facts: Partial<typeof healthy> & Record<string, unknown>) =>
  evaluateDoctor({ ...healthy, ...facts }).map(formatResult);

describe("evaluateDoctor", () => {
  it("reports every prerequisite as ok on a healthy machine", () => {
    expect(lines({})).toEqual([
      "ok   node",
      "ok   pnpm",
      "ok   dependencies",
      "ok   worker types",
      "ok   chromium",
      "ok   .dev.vars",
      "ok   local D1 state",
      "ok   port 5173",
      "ok   verify port",
    ]);
  });

  it("fails an old Node.js version", () => {
    expect(lines({ nodeVersion: "21.9.0" })[0]).toBe("FAIL node — found 21.9.0, need 22+. Fix: install Node.js 22+");
  });

  it("fails a pnpm major version that is not 11", () => {
    expect(lines({ pnpmVersion: "10.2.0" })[1]).toBe("FAIL pnpm — found 10.2.0, need 11. Fix: corepack enable");
    expect(lines({ pnpmVersion: "12.0.0" })[1]).toBe("FAIL pnpm — found 12.0.0, need 11. Fix: corepack enable");
  });

  it("fails when pnpm is not installed", () => {
    expect(lines({ pnpmVersion: undefined })[1]).toBe("FAIL pnpm — found none, need 11. Fix: corepack enable");
  });

  it("names make build when dependencies are missing", () => {
    const out = lines({ hasModules: false, chromium: "no-deps" });
    expect(out[2]).toBe("FAIL dependencies — node_modules is missing. Fix: make build");
    expect(out[4]).toBe("FAIL chromium — dependencies are missing. Fix: make build");
  });

  it("fails missing worker types", () => {
    expect(lines({ hasTypes: false })[3]).toBe(
      "FAIL worker types — worker/worker-configuration.d.ts is missing. Fix: pnpm run cf-typegen",
    );
  });

  it("names make setup when the Chromium browser is missing", () => {
    expect(lines({ chromium: "missing" })[4]).toBe(
      "FAIL chromium — Playwright Chromium is not installed. Fix: make setup",
    );
  });

  it("names make setup when .dev.vars is missing", () => {
    expect(lines({ hasDevVars: false })[5]).toBe("FAIL .dev.vars — .dev.vars is missing. Fix: make setup");
  });

  it("warns when local D1 state is missing", () => {
    expect(lines({ hasD1State: false })[6]).toBe("warn local D1 state — no local D1 state yet; run make migrate");
  });

  it("warns when port 5173 is busy", () => {
    expect(lines({ port5173Free: false })[7]).toBe(
      "warn port 5173 — port 5173 is in use; verify-local selects another port",
    );
  });

  it("fails when no verify port is free and names the range", () => {
    expect(lines({ verifyPort: undefined })[8]).toBe(
      "FAIL verify port — no free port in 5199-5219. Fix: stop the process on the port",
    );
  });

  it("reports a moved verify port as ok", () => {
    expect(lines({ verifyPort: 5201 })[8]).toBe("ok   verify port");
  });
});

describe("chromiumState", () => {
  it("matches the Playwright Chromium install on this machine", () => {
    const expected = existsSync(chromium.executablePath()) ? "ok" : "missing";
    expect(chromiumState(resolve("."))).toBe(expected);
  });

  it("reports missing when @playwright/test cannot be resolved", () => {
    expect(chromiumState(tmpdir())).toBe("missing");
  });
});

describe("doctor without node_modules", () => {
  const dir = mkdtempSync(join(tmpdir(), "doctor-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("gathers facts that show the missing dependencies", async () => {
    const facts = await gatherFacts(dir, {});
    expect(facts).toMatchObject({
      nodeVersion: process.versions.node,
      hasModules: false,
      hasTypes: false,
      chromium: "no-deps",
      hasDevVars: false,
      hasD1State: false,
      verifyStart: 5199,
    });
  });

  it("reads the verify port start from VERIFY_PORT", async () => {
    expect((await gatherFacts(dir, { VERIFY_PORT: "6100" })).verifyStart).toBe(6100);
  });

  it("prints FAIL, names make build, and exits 1", () => {
    const run = spawnSync(process.execPath, [resolve("scripts/doctor.mjs")], { cwd: dir, encoding: "utf8" });
    expect(run.status).toBe(1);
    expect(run.stdout).toContain("FAIL dependencies — node_modules is missing. Fix: make build");
    expect(run.stdout).toMatch(/\nFAIL\n\n\d+ failing checks\n$/);
  });
});
