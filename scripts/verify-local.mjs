#!/usr/bin/env node
// `make verify-local`: start the dev server on a free loopback port, prove each local
// Cloudflare primitive through the public API, stop the server, and print PASS or FAIL.
// Env: VERIFY_PORT (default 5199), VERIFY_TIMEOUT_MS (default 60000). Local only; no remote operation.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_VERIFY_PORT,
  PORT_SPAN,
  createTail,
  fail,
  findFreePort,
  isMain,
  ok,
  pollUntil,
  portRange,
  summarize,
} from "./lib/local-dev.mjs";
import { smokeChecks } from "./verify.mjs";

/** @typedef {{ name: string, level: string, detail?: string, fix?: string }} Result */
/** @typedef {{ timeoutMs: number, intervalMs: number }} PollOptions */

export const PROBE_HTML = "<!doctype html><html><body><h1>verify-local probe</h1></body></html>";
const AFTER_QUEUE = new Set(["approved", "rejected", "published", "failed"]);
const AFTER_WORKFLOW = new Set(["rejected", "published", "failed"]);

/** @param {number} port */
export const viteArgs = (port) => ["exec", "vite", "--port", String(port), "--strictPort", "--host", "127.0.0.1"];

/**
 * Start a command in its own process group and keep the last 200 output lines.
 * @param {string} command
 * @param {string[]} args
 * @param {string} cwd
 * @param {{ graceMs?: number }} [options]
 */
export function startServer(command, args, cwd, { graceMs = 5000 } = {}) {
  const child = spawn(command, args, { cwd, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  const tail = createTail(200);
  child.stdout.on("data", (chunk) => tail.push(String(chunk)));
  child.stderr.on("data", (chunk) => tail.push(String(chunk)));
  let running = true;
  // A spawn failure (for example ENOENT) emits "error" and can skip "exit".
  const exited = new Promise((resolve) => child.once("exit", resolve).once("error", resolve)).then(
    () => (running = false),
  );
  const signal = (/** @type {NodeJS.Signals} */ name) => killGroup(/** @type {number} */ (child.pid), name);
  return {
    tail,
    alive: () => running,
    /** Kill the group at once. Safe to call from an `exit` handler. */
    killNow: () => signal("SIGKILL"),
    /** SIGTERM to the group, then SIGKILL after the grace period. */
    async stop() {
      signal("SIGTERM");
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, graceMs))]);
      signal("SIGKILL");
      await exited;
    },
  };
}

/** @param {number} pid @param {NodeJS.Signals} name */
function killGroup(pid, name) {
  try {
    if (process.platform === "win32") spawnSync("taskkill", ["/T", "/F", "/PID", String(pid)]);
    else process.kill(-pid, name);
  } catch {
    // The group is already gone.
  }
}

/** @param {string} base */
async function healthStatus(base) {
  try {
    return (await (await fetch(`${base}/api/health`)).json()).status;
  } catch {
    return "unreachable";
  }
}

/**
 * Confirm that our own child is alive and that it answers health with "ok".
 * @param {string} base
 * @param {{ alive: () => boolean }} server
 * @param {PollOptions} options
 */
export async function waitHealthy(base, server, options) {
  const read = async () => (server.alive() ? await healthStatus(base) : "exited");
  const { value } = await pollUntil(read, (v) => v === "ok" || v === "exited", options);
  if (value === "ok") return ok("server started");
  if (value === "exited") return fail("server started", "dev server exited before it was healthy");
  return fail("server started", `health did not return ok within ${options.timeoutMs} ms (last: ${value})`);
}

/** @param {string} base @returns {Promise<Result[]>} */
async function smokeResults(base) {
  const results = [];
  for (const [label, run] of smokeChecks(base)) {
    const name = `worker route: ${label}`;
    results.push(await attempt(name, async () => ((await run()) ? ok(name) : fail(name, "the check returned false"))));
  }
  return results;
}

/** Run a check and turn a thrown error into a FAIL result. @param {string} name @param {() => Promise<Result>} run */
async function attempt(name, run) {
  try {
    return await run();
  } catch (error) {
    return fail(name, String(error));
  }
}

/** Run `run` only when `previous` passed. @param {Result} previous @param {string} name @param {() => Promise<Result>} run */
function after(previous, name, run) {
  return previous.level === "ok" ? attempt(name, run) : Promise.resolve(fail(name, `skipped: ${previous.name} failed`));
}

/**
 * Wait for the submission status to reach a set of states.
 * @param {string} name
 * @param {() => Promise<string>} read
 * @param {Set<string>} states
 * @param {(status: string) => boolean} isOk
 * @param {string} id
 * @param {PollOptions} options
 */
async function statusCheck(name, read, states, isOk, id, options) {
  const { done, value } = await pollUntil(read, (s) => states.has(s), options);
  if (!done) return fail(name, `submission ${id}: timed out after ${options.timeoutMs} ms (last: ${value})`);
  return isOk(value) ? ok(name) : fail(name, `submission ${id}: status is ${value}`);
}

/**
 * Prove D1, R2, the Queue consumer, the Workflow, and the Local Explorer through the public API.
 * @param {string} base
 * @param {PollOptions} options
 * @returns {Promise<Result[]>}
 */
export async function primitiveChecks(base, options) {
  let id = "";
  const write = await attempt("d1 + r2 write", async () => {
    const response = await fetch(`${base}/api/submissions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: `verify-local-${Date.now()}`, html: PROBE_HTML }),
    });
    id = (await response.json()).id;
    return response.status === 202
      ? ok("d1 + r2 write")
      : fail("d1 + r2 write", `POST /api/submissions returned ${response.status}`);
  });
  const read = async () => (await (await fetch(`${base}/api/submissions/${id}`)).json()).status;
  const queue = await after(write, "queue consumer", () =>
    statusCheck("queue consumer", read, AFTER_QUEUE, () => true, id, options),
  );
  const workflow = await after(queue, "workflow", () =>
    statusCheck("workflow", read, AFTER_WORKFLOW, (s) => s === "published", id, options),
  );
  const copy = await after(workflow, "r2 published copy", async () => {
    const body = await (await fetch(`${base}/api/submissions/${id}/artifact`)).text();
    return body === PROBE_HTML
      ? ok("r2 published copy")
      : fail("r2 published copy", "the published artifact does not match the posted html");
  });
  const explorer = await attempt("local explorer", async () => {
    const { status } = await fetch(`${base}/cdn-cgi/local/explorer`);
    return status === 200
      ? ok("local explorer")
      : fail("local explorer", `GET /cdn-cgi/local/explorer returned ${status}`);
  });
  return [write, queue, workflow, copy, explorer];
}

/**
 * @param {string} base
 * @param {{ alive: () => boolean }} server
 * @param {PollOptions} options
 */
export async function runAll(base, server, options) {
  const started = await waitHealthy(base, server, options);
  if (started.level !== "ok") return [started];
  return [started, ...(await smokeResults(base)), ...(await primitiveChecks(base, options))];
}

/** @param {Result[]} results @param {string} [diagnostics] */
function report(results, diagnostics = "") {
  const { lines, exitCode } = summarize(results);
  if (exitCode !== 0 && diagnostics) console.log(diagnostics);
  console.log(lines.join("\n"));
  return exitCode;
}

/** @param {string} cwd @param {Record<string, string | undefined>} env */
async function main(cwd, env) {
  if (!existsSync(join(cwd, "node_modules"))) {
    console.log("Run 'make build' first.");
    return report([fail("dependencies", "node_modules is missing", "make build")]);
  }
  const start = Number(env.VERIFY_PORT ?? DEFAULT_VERIFY_PORT);
  if (!Number.isInteger(start) || start < 1024 || start + PORT_SPAN > 65535) {
    return report([fail("select port", `VERIFY_PORT must be an integer from 1024 to ${65535 - PORT_SPAN}`)]);
  }
  const options = { timeoutMs: Number(env.VERIFY_TIMEOUT_MS ?? 60000), intervalMs: 250 };
  const port = await findFreePort(start, PORT_SPAN);
  if (port === undefined) {
    return report([fail("select port", `no free port in ${portRange(start)}`, "stop the process on the port")]);
  }
  const migrate = spawnSync("pnpm", ["run", "db:migrate:local"], { cwd, encoding: "utf8" });
  if (migrate.status !== 0) {
    return report(
      [fail("local migrations", "db:migrate:local failed", "make migrate")],
      migrate.stdout + migrate.stderr,
    );
  }
  const base = `http://127.0.0.1:${port}`;
  console.log(`dev server: ${base}`);
  const server = startServer("pnpm", viteArgs(port), cwd);
  const abort = () => process.exit(130);
  process.once("SIGINT", abort).once("SIGTERM", abort).once("exit", server.killNow);
  let results;
  try {
    results = await runAll(base, server, options);
  } finally {
    await server.stop();
  }
  return report(results, `--- dev server output (${base}, last 200 lines) ---\n${server.tail.text()}\n---`);
}

if (isMain(import.meta.url)) {
  process.exit(await main(process.cwd(), process.env));
}
