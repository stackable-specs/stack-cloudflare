#!/usr/bin/env node
// `check` command: deterministic PASS or FAIL (spec: docs/specs/interface/commands.md).
// Usage: node scripts/check.mjs [--all] [--verbose] [--category <name>]
import { spawnSync } from "node:child_process";

const categories = [
  ["format", ["pnpm", "run", "format:check"]],
  ["lint", ["pnpm", "run", "lint"]],
  ["types", ["pnpm", "run", "typecheck"]],
  ["unit", ["pnpm", "run", "test:unit"]],
  ["worker", ["pnpm", "run", "test:worker"]],
  [
    "wrangler-types",
    ["pnpm", "exec", "wrangler", "types", "worker/worker-configuration.d.ts", "--include-env=false", "--check"],
  ],
];

const args = process.argv.slice(2);
const all = args.includes("--all");
const verbose = args.includes("--verbose");
const only = args.includes("--category") ? args[args.indexOf("--category") + 1] : undefined;

const failures = [];
for (const [name, [cmd, ...rest]] of categories) {
  if (only && only !== name) continue;
  const result = spawnSync(cmd, rest, { stdio: verbose ? "inherit" : "pipe", encoding: "utf8" });
  if (result.status !== 0) {
    failures.push(name);
    if (!verbose) {
      process.stderr.write(`\n--- ${name} ---\n${result.stdout ?? ""}${result.stderr ?? ""}\n`);
    }
    if (!all) break;
  }
}

if (failures.length === 0) {
  console.log("PASS");
  process.exit(0);
}
console.log(`FAIL\n\n${failures.map((f) => `1 failing category: ${f}`).join("\n")}`);
process.exit(1);
