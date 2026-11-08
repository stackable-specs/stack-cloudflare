import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { formatResult } from "../../../scripts/lib/local-dev.mjs";
import {
  PROBE_HTML,
  primitiveChecks,
  runAll,
  startServer,
  viteArgs,
  waitHealthy,
} from "../../../scripts/verify-local.mjs";
import { FAKE_ID, startFakeWorker, type FakeWorker } from "./fake-worker";

const fast = { timeoutMs: 200, intervalMs: 10 };
const alive = { alive: () => true };
const lines = (results: { name: string; level: string }[]) => results.map(formatResult);

let worker: FakeWorker | undefined;
afterEach(async () => {
  await worker?.close();
  worker = undefined;
});

describe("viteArgs", () => {
  it("binds Vite to loopback on the exact port", () => {
    expect(viteArgs(5201)).toEqual(["exec", "vite", "--port", "5201", "--strictPort", "--host", "127.0.0.1"]);
  });
});

describe("waitHealthy", () => {
  it("reports ok when health returns ok", async () => {
    worker = await startFakeWorker();
    expect(lines([await waitHealthy(worker.base, alive, fast)])).toEqual(["ok   server started"]);
  });

  it("fails when the dev server process exits", async () => {
    worker = await startFakeWorker();
    expect(lines([await waitHealthy(worker.base, { alive: () => false }, fast)])).toEqual([
      "FAIL server started — dev server exited before it was healthy",
    ]);
  });

  it("fails with the timeout when health never returns ok", async () => {
    worker = await startFakeWorker({ health: "degraded" });
    expect(lines([await waitHealthy(worker.base, alive, fast)])).toEqual([
      "FAIL server started — health did not return ok within 200 ms (last: degraded)",
    ]);
  });

  it("fails when nothing listens on the URL", async () => {
    expect(lines([await waitHealthy("http://127.0.0.1:9", alive, fast)])).toEqual([
      "FAIL server started — health did not return ok within 200 ms (last: unreachable)",
    ]);
  });
});

describe("primitiveChecks", () => {
  it("reports each primitive as ok when the submission is published", async () => {
    worker = await startFakeWorker();
    expect(lines(await primitiveChecks(worker.base, fast))).toEqual([
      "ok   d1 + r2 write",
      "ok   queue consumer",
      "ok   workflow",
      "ok   r2 published copy",
      "ok   local explorer",
    ]);
    expect(worker.posted).toEqual([{ title: expect.stringMatching(/^verify-local-\d+$/), html: PROBE_HTML }]);
  });

  it("fails the workflow with the final status when the artifact is rejected", async () => {
    worker = await startFakeWorker({ statuses: ["submitted", "rejected"] });
    expect(lines(await primitiveChecks(worker.base, fast)).slice(1, 4)).toEqual([
      "ok   queue consumer",
      `FAIL workflow — submission ${FAKE_ID}: status is rejected`,
      "FAIL r2 published copy — skipped: workflow failed",
    ]);
  });

  it("fails the queue consumer with the last status after the timeout", async () => {
    worker = await startFakeWorker({ statuses: ["submitted"] });
    expect(lines(await primitiveChecks(worker.base, fast)).slice(1, 3)).toEqual([
      `FAIL queue consumer — submission ${FAKE_ID}: timed out after 200 ms (last: submitted)`,
      "FAIL workflow — skipped: queue consumer failed",
    ]);
  });

  it("fails the workflow when it stays approved past the timeout", async () => {
    worker = await startFakeWorker({ statuses: ["approved"] });
    expect(lines(await primitiveChecks(worker.base, fast))[2]).toBe(
      `FAIL workflow — submission ${FAKE_ID}: timed out after 200 ms (last: approved)`,
    );
  });

  it("fails the published copy when the body differs from the posted html", async () => {
    worker = await startFakeWorker({ artifactBody: "other" });
    expect(lines(await primitiveChecks(worker.base, fast))[3]).toBe(
      "FAIL r2 published copy — the published artifact does not match the posted html",
    );
  });

  it("fails the write and skips the dependent checks when the POST is not accepted", async () => {
    worker = await startFakeWorker({ postStatus: 500 });
    expect(lines(await primitiveChecks(worker.base, fast))).toEqual([
      "FAIL d1 + r2 write — POST /api/submissions returned 500",
      "FAIL queue consumer — skipped: d1 + r2 write failed",
      "FAIL workflow — skipped: queue consumer failed",
      "FAIL r2 published copy — skipped: workflow failed",
      "ok   local explorer",
    ]);
  });

  it("fails the local explorer when it does not return 200", async () => {
    worker = await startFakeWorker({ explorerStatus: 404 });
    expect(lines(await primitiveChecks(worker.base, fast))[4]).toBe(
      "FAIL local explorer — GET /cdn-cgi/local/explorer returned 404",
    );
  });

  it("reports fetch errors as FAIL lines", async () => {
    const out = lines(await primitiveChecks("http://127.0.0.1:9", fast));
    expect(out[0]).toMatch(/^FAIL d1 \+ r2 write — TypeError: fetch failed$/);
    expect(out[4]).toMatch(/^FAIL local explorer — TypeError: fetch failed$/);
  });
});

describe("runAll", () => {
  it("runs the smoke and primitive checks after the server is healthy", async () => {
    worker = await startFakeWorker();
    expect(lines(await runAll(worker.base, alive, fast))).toEqual([
      "ok   server started",
      "ok   worker route: health endpoint answers ok",
      "ok   worker route: invalid submission returns 400",
      "ok   worker route: unknown API route returns 404",
      "ok   worker route: SPA shell is served",
      "ok   d1 + r2 write",
      "ok   queue consumer",
      "ok   workflow",
      "ok   r2 published copy",
      "ok   local explorer",
    ]);
  });

  it("stops after the start check when the server is not healthy", async () => {
    expect(lines(await runAll("http://127.0.0.1:9", { alive: () => false }, fast))).toEqual([
      "FAIL server started — dev server exited before it was healthy",
    ]);
  });

  it("reports a failed smoke check as a FAIL line", async () => {
    worker = await startFakeWorker({ spaBody: "<p>no app</p>" });
    expect(lines(await runAll(worker.base, alive, fast))[4]).toBe(
      "FAIL worker route: SPA shell is served — the check returned false",
    );
  });
});

describe("startServer", () => {
  const dir = mkdtempSync(join(tmpdir(), "verify-local-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const isRunning = (pid: number) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };

  it("keeps the output and stops the whole process group", async () => {
    const pidFile = join(dir, "grandchild.pid");
    const script = [
      "const { spawn } = require('node:child_process');",
      "const g = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });",
      `require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(g.pid));`,
      "console.log('server ready');",
      "setInterval(() => {}, 1000);",
    ].join("\n");
    const server = startServer(process.execPath, ["-e", script], dir);
    await expect.poll(() => server.tail.text(), { timeout: 5000 }).toContain("server ready");
    const grandchild = Number(readFileSync(pidFile, "utf8"));
    expect(server.alive()).toBe(true);
    await server.stop();
    expect(server.alive()).toBe(false);
    await expect.poll(() => isRunning(grandchild), { timeout: 5000 }).toBe(false);
  });

  it("reports a process that exits at once as not alive", async () => {
    const server = startServer(process.execPath, ["-e", "console.error('port in use'); process.exit(1)"], dir);
    await expect.poll(() => server.alive(), { timeout: 5000 }).toBe(false);
    expect(server.tail.text()).toBe("port in use");
    await server.stop();
  });

  it("uses SIGKILL when the process ignores SIGTERM", async () => {
    const script = "process.on('SIGTERM', () => {}); console.log('up'); setInterval(() => {}, 1000);";
    const server = startServer(process.execPath, ["-e", script], dir, { graceMs: 100 });
    await expect.poll(() => server.tail.text(), { timeout: 5000 }).toBe("up");
    await server.stop();
    expect(server.alive()).toBe(false);
  });
});

describe("verify-local CLI", () => {
  const dir = mkdtempSync(join(tmpdir(), "verify-local-cli-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("fails at once without node_modules and names make build", () => {
    const run = spawnSync(process.execPath, [resolve("scripts/verify-local.mjs")], { cwd: dir, encoding: "utf8" });
    expect(run.status).toBe(1);
    expect(run.stdout).toBe(
      "Run 'make build' first.\nFAIL dependencies — node_modules is missing. Fix: make build\nFAIL\n\n1 failing checks\n",
    );
  });
});
