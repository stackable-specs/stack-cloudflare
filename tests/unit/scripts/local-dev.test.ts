import net from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  createTail,
  fail,
  findFreePort,
  formatResult,
  isPortFree,
  ok,
  parseMajor,
  pollUntil,
  summarize,
  warn,
} from "../../../scripts/lib/local-dev.mjs";

describe("formatResult", () => {
  it("prints an ok line", () => {
    expect(formatResult(ok("node"))).toBe("ok   node");
  });

  it("prints a warn line with its detail", () => {
    expect(formatResult(warn("port 5173", "in use"))).toBe("warn port 5173 — in use");
  });

  it("prints a FAIL line with its detail and fix", () => {
    expect(formatResult(fail("dependencies", "node_modules is missing", "make build"))).toBe(
      "FAIL dependencies — node_modules is missing. Fix: make build",
    );
  });

  it("prints a FAIL line without a fix", () => {
    expect(formatResult(fail("workflow", "status is rejected"))).toBe("FAIL workflow — status is rejected");
  });
});

describe("summarize", () => {
  it("ends with PASS and exit code 0 when no check fails", () => {
    expect(summarize([ok("a"), warn("b", "slow")])).toEqual({
      lines: ["ok   a", "warn b — slow", "PASS"],
      exitCode: 0,
    });
  });

  it("ends with FAIL and the count of failing checks", () => {
    expect(summarize([fail("a", "x"), ok("b"), fail("c", "y")])).toEqual({
      lines: ["FAIL a — x", "ok   b", "FAIL c — y", "FAIL\n\n2 failing checks"],
      exitCode: 1,
    });
  });
});

describe("parseMajor", () => {
  it("reads the major number of a version", () => {
    expect(parseMajor("22.11.0")).toBe(22);
    expect(parseMajor("v26.1.0\n")).toBe(26);
  });

  it("returns undefined for text that is not a version", () => {
    expect(parseMajor("not found")).toBeUndefined();
    expect(parseMajor(undefined)).toBeUndefined();
  });
});

describe("findFreePort", () => {
  it("returns the first port that is free", async () => {
    const free = new Set([5203, 5204]);
    expect(await findFreePort(5199, 20, async (p: number) => free.has(p))).toBe(5203);
  });

  it("tests the last port of the range", async () => {
    expect(await findFreePort(5199, 20, async (p: number) => p === 5219)).toBe(5219);
  });

  it("returns undefined when no port in the range is free", async () => {
    expect(await findFreePort(5199, 20, async (p: number) => p === 5220)).toBeUndefined();
  });
});

describe("isPortFree", () => {
  const servers: net.Server[] = [];
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))));
  });

  async function listen(host: string): Promise<number> {
    const server = net.createServer();
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, host, resolve));
    return (server.address() as net.AddressInfo).port;
  }

  it("reports a port with a listener on 127.0.0.1 as busy", async () => {
    const port = await listen("127.0.0.1");
    expect(await isPortFree(port)).toBe(false);
  });

  it("reports a port as free after its listener closes", async () => {
    const port = await listen("127.0.0.1");
    await new Promise((r) => servers.pop()?.close(r));
    expect(await isPortFree(port)).toBe(true);
  });
});

describe("pollUntil", () => {
  function clock() {
    let t = 0;
    return { now: () => t, sleep: async (ms: number) => void (t += ms) };
  }

  it("returns the first value that is done", async () => {
    const values = ["submitted", "submitted", "approved"];
    const result = await pollUntil(
      async () => values.shift(),
      (v: string | undefined) => v !== "submitted",
      { timeoutMs: 1000, intervalMs: 250, ...clock() },
    );
    expect(result).toEqual({ done: true, value: "approved" });
  });

  it("returns the last value when the timeout expires", async () => {
    const c = clock();
    const result = await pollUntil(
      async () => "submitted",
      () => false,
      { timeoutMs: 1000, intervalMs: 250, ...c },
    );
    expect(result).toEqual({ done: false, value: "submitted" });
    expect(c.now()).toBe(1000);
  });
});

describe("createTail", () => {
  it("keeps only the last lines", () => {
    const tail = createTail(2);
    tail.push("one\ntwo\n");
    tail.push("three\n");
    expect(tail.text()).toBe("two\nthree");
  });

  it("joins a line that arrives in two chunks", () => {
    const tail = createTail(5);
    tail.push("hel");
    tail.push("lo\nworld");
    expect(tail.text()).toBe("hello\nworld");
  });
});
