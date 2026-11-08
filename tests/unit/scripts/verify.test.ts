import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { startFakeWorker, type FakeWorker } from "./fake-worker";

function runVerify(baseUrl: string): Promise<{ status: number | null; stdout: string }> {
  return new Promise((done) => {
    const child = spawn(process.execPath, [resolve("scripts/verify.mjs")], {
      env: { ...process.env, BASE_URL: baseUrl },
    });
    let stdout = "";
    child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    child.on("close", (status) => done({ status, stdout }));
  });
}

describe("scripts/verify.mjs CLI", () => {
  let worker: FakeWorker | undefined;
  afterEach(async () => {
    await worker?.close();
    worker = undefined;
  });

  it("prints four ok lines and PASS against a healthy API", async () => {
    worker = await startFakeWorker();
    const run = await runVerify(worker.base);
    expect(run.status).toBe(0);
    expect(run.stdout).toBe(
      [
        "ok   health endpoint answers ok",
        "ok   invalid submission returns 400",
        "ok   unknown API route returns 404",
        "ok   SPA shell is served",
        "PASS",
        "",
      ].join("\n"),
    );
  });

  it("prints FAIL and the count when the health check fails", async () => {
    worker = await startFakeWorker({ health: "degraded" });
    const run = await runVerify(worker.base);
    expect(run.status).toBe(1);
    expect(run.stdout).toContain("FAIL health endpoint answers ok\n");
    expect(run.stdout).toMatch(/\nFAIL\n\n1 failing checks\n$/);
  });

  it("fails every check when nothing listens on BASE_URL", async () => {
    worker = await startFakeWorker();
    const base = worker.base;
    await worker.close();
    worker = undefined;
    const run = await runVerify(base);
    expect(run.status).toBe(1);
    expect(run.stdout).toMatch(/\nFAIL\n\n4 failing checks\n$/);
  });
});
