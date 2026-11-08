// Shared helpers for scripts/doctor.mjs and scripts/verify-local.mjs. Node.js built-ins only.
import net from "node:net";
import { pathToFileURL } from "node:url";

/** @param {string} name */
export const ok = (name) => ({ name, level: "ok" });
/** @param {string} name @param {string} detail */
export const warn = (name, detail) => ({ name, level: "warn", detail });
/** @param {string} name @param {string} detail @param {string} [fix] */
export const fail = (name, detail, fix) => ({ name, level: "fail", detail, fix });

/** @param {{ name: string, level: string, detail?: string, fix?: string }} result */
export function formatResult({ name, level, detail, fix }) {
  if (level === "ok") return `ok   ${name}`;
  const prefix = level === "warn" ? "warn" : "FAIL";
  return `${prefix} ${name} — ${detail}${fix ? `. Fix: ${fix}` : ""}`;
}

/** @param {Array<{ name: string, level: string, detail?: string, fix?: string }>} results */
export function summarize(results) {
  const failed = results.filter((r) => r.level === "fail").length;
  const lines = results.map(formatResult);
  lines.push(failed === 0 ? "PASS" : `FAIL\n\n${failed} failing checks`);
  return { lines, exitCode: failed === 0 ? 0 : 1 };
}

/** @param {string | undefined} version */
export function parseMajor(version) {
  const match = /^v?(\d+)\./.exec(String(version).trim());
  return match ? Number(match[1]) : undefined;
}

export const DEFAULT_VERIFY_PORT = 5199;
export const PORT_SPAN = 20;

/** @param {number} start */
export const portRange = (start) => `${start}-${start + PORT_SPAN}`;

// An address family that the host does not have counts as free.
const NO_FAMILY = new Set(["EADDRNOTAVAIL", "EAFNOSUPPORT"]);

/** @param {number} port @param {string} host @returns {Promise<boolean>} */
function canListen(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (/** @type {NodeJS.ErrnoException} */ error) => resolve(NO_FAMILY.has(error.code ?? "")));
    server.listen({ port, host, exclusive: true }, () => server.close(() => resolve(true)));
  });
}

/** A port is free only when it can listen on both loopback addresses. @param {number} port */
export async function isPortFree(port) {
  return (await canListen(port, "127.0.0.1")) && (await canListen(port, "::1"));
}

/**
 * @param {number} start
 * @param {number} span
 * @param {(port: number) => Promise<boolean>} [isFree]
 */
export async function findFreePort(start, span, isFree = isPortFree) {
  for (let port = start; port <= start + span; port += 1) {
    if (await isFree(port)) return port;
  }
  return undefined;
}

/**
 * Read a value until it is done or the timeout expires.
 * @template T
 * @param {() => Promise<T>} read
 * @param {(value: T) => boolean} isDone
 * @param {{ timeoutMs: number, intervalMs: number, now?: () => number, sleep?: (ms: number) => Promise<void> }} options
 */
export async function pollUntil(read, isDone, { timeoutMs, intervalMs, now = Date.now, sleep = delay }) {
  const deadline = now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (isDone(value)) return { done: true, value };
    if (now() >= deadline) return { done: false, value };
    await sleep(intervalMs);
  }
}

/** @param {number} ms */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Keep the last `limit` lines of a stream. @param {number} limit */
export function createTail(limit) {
  /** @type {string[]} */
  let lines = [""];
  return {
    /** @param {string} chunk */
    push(chunk) {
      const parts = String(chunk).split("\n");
      lines[lines.length - 1] += parts.shift();
      lines = lines.concat(parts).slice(-(limit + 1));
    },
    text() {
      return lines
        .filter((line) => line !== "")
        .slice(-limit)
        .join("\n");
    },
  };
}

/** True when the module at `metaUrl` is the script that node started. @param {string} metaUrl */
export function isMain(metaUrl) {
  return process.argv[1] !== undefined && metaUrl === pathToFileURL(process.argv[1]).href;
}
