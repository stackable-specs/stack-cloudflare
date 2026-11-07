#!/usr/bin/env node
// Smoke checks for a running deployment. Usage: BASE_URL=https://staging.example.com pnpm verify
const base = process.env.BASE_URL ?? "http://localhost:5173";

const checks = [
  [
    "health endpoint answers ok",
    async () => {
      const r = await fetch(`${base}/api/health`);
      const body = await r.json();
      return r.status === 200 && body.status === "ok";
    },
  ],
  [
    "invalid submission returns 400",
    async () => {
      const r = await fetch(`${base}/api/submissions`, {
        method: "POST",
        body: "{}",
        headers: { "content-type": "application/json" },
      });
      return r.status === 400;
    },
  ],
  ["unknown API route returns 404", async () => (await fetch(`${base}/api/does-not-exist`)).status === 404],
  ["SPA shell is served", async () => (await (await fetch(base)).text()).includes('id="root"')],
];

let failed = 0;
for (const [name, run] of checks) {
  let ok = false;
  try {
    ok = await run();
  } catch (error) {
    console.error(`  ${name}: ${error}`);
  }
  console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
  if (!ok) failed += 1;
}
console.log(failed === 0 ? "PASS" : `FAIL\n\n${failed} failing checks`);
process.exit(failed === 0 ? 0 : 1);
