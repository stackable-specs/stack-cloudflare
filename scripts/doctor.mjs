#!/usr/bin/env node
// `make doctor`: check the local development prerequisites. Prints PASS or FAIL.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import {
  DEFAULT_VERIFY_PORT,
  PORT_SPAN,
  fail,
  findFreePort,
  isMain,
  isPortFree,
  ok,
  parseMajor,
  portRange,
  summarize,
  warn,
} from "./lib/local-dev.mjs";

/** Resolve Chromium from the project's own @playwright/test. @param {string} cwd */
export function chromiumState(cwd) {
  try {
    const { chromium } = createRequire(join(cwd, "package.json"))("@playwright/test");
    return existsSync(chromium.executablePath()) ? "ok" : "missing";
  } catch {
    return "missing";
  }
}

/** @param {string} cwd */
function pnpmVersion(cwd) {
  const run = spawnSync("pnpm", ["--version"], { cwd, encoding: "utf8" });
  return run.status === 0 ? run.stdout.trim() : undefined;
}

/** @param {string} cwd @param {Record<string, string | undefined>} env */
export async function gatherFacts(cwd, env) {
  const at = (/** @type {string} */ path) => existsSync(join(cwd, path));
  const hasModules = at("node_modules/.modules.yaml");
  const verifyStart = Number(env.VERIFY_PORT ?? DEFAULT_VERIFY_PORT);
  return {
    nodeVersion: process.versions.node,
    pnpmVersion: pnpmVersion(cwd),
    hasModules,
    hasTypes: at("worker/worker-configuration.d.ts"),
    chromium: hasModules ? chromiumState(cwd) : "no-deps",
    hasDevVars: at(".dev.vars"),
    hasD1State: at(".wrangler/state/v3/d1"),
    port5173Free: await isPortFree(5173),
    verifyStart,
    verifyPort: await findFreePort(verifyStart, PORT_SPAN),
  };
}

const CHROMIUM = {
  ok: ok("chromium"),
  missing: fail("chromium", "Playwright Chromium is not installed", "make setup"),
  "no-deps": fail("chromium", "dependencies are missing", "make build"),
};

/** @param {boolean} pass @param {ReturnType<typeof ok>} okResult @param {ReturnType<typeof fail>} other */
const either = (pass, okResult, other) => (pass ? okResult : other);

/** @param {Awaited<ReturnType<typeof gatherFacts>>} facts */
export function evaluateDoctor(facts) {
  const nodeMajor = parseMajor(facts.nodeVersion) ?? 0;
  return [
    either(nodeMajor >= 22, ok("node"), fail("node", `found ${facts.nodeVersion}, need 22+`, "install Node.js 22+")),
    either(
      parseMajor(facts.pnpmVersion) === 11,
      ok("pnpm"),
      fail("pnpm", `found ${facts.pnpmVersion ?? "none"}, need 11`, "corepack enable"),
    ),
    either(facts.hasModules, ok("dependencies"), fail("dependencies", "node_modules is missing", "make build")),
    either(
      facts.hasTypes,
      ok("worker types"),
      fail("worker types", "worker/worker-configuration.d.ts is missing", "pnpm run cf-typegen"),
    ),
    CHROMIUM[/** @type {keyof typeof CHROMIUM} */ (facts.chromium)],
    either(facts.hasDevVars, ok(".dev.vars"), fail(".dev.vars", ".dev.vars is missing", "make setup")),
    either(facts.hasD1State, ok("local D1 state"), warn("local D1 state", "no local D1 state yet; run make migrate")),
    either(
      facts.port5173Free,
      ok("port 5173"),
      warn("port 5173", "port 5173 is in use; verify-local selects another port"),
    ),
    either(
      facts.verifyPort !== undefined,
      ok("verify port"),
      fail("verify port", `no free port in ${portRange(facts.verifyStart)}`, "stop the process on the port"),
    ),
  ];
}

if (isMain(import.meta.url)) {
  const { lines, exitCode } = summarize(evaluateDoctor(await gatherFacts(process.cwd(), process.env)));
  console.log(lines.join("\n"));
  process.exit(exitCode);
}
