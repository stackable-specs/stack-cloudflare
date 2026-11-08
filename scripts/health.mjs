#!/usr/bin/env node
// `health` command: synthesized assessment (spec: docs/specs/interface/commands.md).
// The score is a simple, transparent heuristic. Adjust the weights for your project.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};
const loc = (files) => files.reduce((n, f) => n + readFileSync(f, "utf8").split("\n").length, 0);
const code = (dir) => walk(dir).filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith("worker-configuration.d.ts"));

const src = [...code("worker"), ...code("src")];
const tests = [...code("tests"), ...code("e2e")];
const adrs = walk("docs/adr").filter((f) => /\/\d{3}-/.test(f) && !f.includes("000-template"));
const bdrs = walk("docs/bdr").filter((f) => /\/\d{3}-/.test(f) && !f.includes("000-template"));
const migrations = walk("migrations").filter((f) => f.endsWith(".sql"));
const wrangler = readFileSync("wrangler.jsonc", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

const strengths = [];
const risks = [];
const recs = [];
let score = 100;

const ratio = loc(tests) / Math.max(1, loc(src));
if (ratio >= 0.5) strengths.push(`Test-to-source ratio is ${ratio.toFixed(2)} (${tests.length} test files).`);
else {
  score -= 15;
  risks.push(`Test-to-source ratio is low (${ratio.toFixed(2)}).`);
  recs.push("Add Worker tests for each new route and binding.");
}

if (/"compatibility_date":\s*"\d{4}-\d{2}-\d{2}"/.test(wrangler))
  strengths.push("Worker compatibility_date is pinned.");
else {
  score -= 10;
  risks.push("compatibility_date is not pinned.");
}

const placeholders = (wrangler.match(/REPLACE_WITH_[A-Z0-9_]+/g) ?? []).length;
if (placeholders > 0) {
  score -= 5;
  risks.push(
    `${placeholders} staging resource ${placeholders === 1 ? "ID is a placeholder" : "IDs are placeholders"}.`,
  );
  recs.push("Create staging resources and replace the REPLACE_WITH_* IDs in wrangler.jsonc.");
}

if (wrangler.includes("00000000-0000-0000-0000-000000000000")) {
  strengths.push("The local D1 database_id is the zero UUID, so it cannot point at a real database.");
}

if (existsSync(".dev.vars") && spawnSync("git", ["ls-files", "--error-unmatch", ".dev.vars"]).status === 0) {
  score -= 40;
  risks.push(".dev.vars is tracked by git. It can contain secrets.");
  recs.unshift("Remove .dev.vars from git and rotate its secrets.");
}

if (adrs.length > 0) strengths.push(`${adrs.length} ADRs record the architecture decisions.`);
else {
  score -= 10;
  recs.push("Record architecture decisions in docs/adr.");
}
if (bdrs.length > 0) strengths.push(`${bdrs.length} BDRs define observable behavior.`);
else {
  score -= 10;
  recs.push("Write a BDR for each user-visible capability.");
}

const unpinned = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies }).filter(([, v]) => /^[\^~]/.test(v));
if (unpinned.length === 0) strengths.push("All dependencies are pinned to exact versions.");
else {
  score -= Math.min(15, unpinned.length * 2);
  risks.push(`${unpinned.length} dependencies use ranges: ${unpinned.map(([n]) => n).join(", ")}.`);
  recs.push("Pin dependency versions (spec: security/dependency-management.md).");
}

if (recs.length === 0) recs.push("Run `make e2e` and deploy to staging to test Workflows with real resources.");

score = Math.max(0, score);
const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
console.log(`Overall: ${grade} (${score}/100)\n`);
console.log(
  `Size: ${src.length} source files (${loc(src)} LOC), ${tests.length} test files (${loc(tests)} LOC), ${migrations.length} D1 migrations.\n`,
);
console.log("Strengths");
for (const s of strengths) console.log(`• ${s}`);
console.log("\nRisks");
for (const r of risks.length ? risks : ["No significant risks found."]) console.log(`• ${r}`);
console.log("\nRecommendations");
recs.slice(0, 3).forEach((r, i) => console.log(`${i + 1}. ${r}`));
