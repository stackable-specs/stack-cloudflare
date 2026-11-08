import {
  createExecutionContext,
  createMessageBatch,
  getQueueResult,
  introspectWorkflowInstance,
} from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { MAX_ARTIFACT_BYTES, publishedKey, sha256Hex, submissionKey } from "../../worker/domain/submission";
import type { Env, EvaluationMessage, PublicationParams } from "../../worker/env";
import worker from "../../worker/index";
import { getSubmission } from "../../worker/repository";

const GOOD_HTML = "<html><body><h1>Hello</h1></body></html>";
const BAD_HTML = "<html><script>alert(1)</script></html>";
const UNKNOWN_ID = "00000000-0000-0000-0000-000000000000";

async function post(body: string, contentType = "application/json"): Promise<Response> {
  return exports.default.fetch("http://example.com/api/submissions", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });
}

const submit = (body: unknown): Promise<Response> => post(JSON.stringify(body));

async function submitId(title: string, html: string): Promise<string> {
  const response = await submit({ title, html });
  expect(response.status).toBe(202);
  return (await response.json<{ id: string }>()).id;
}

async function deliver(id: string, testEnv: Env = env, messageId = `msg-${id}`): Promise<string[]> {
  const batch = createMessageBatch<EvaluationMessage>("stack-cloudflare-evaluations", [
    { id: messageId, timestamp: new Date(), attempts: 1, body: { id } },
  ]);
  const ctx = createExecutionContext();
  await worker.queue(batch, testEnv, ctx);
  const result = await getQueueResult(batch, ctx);
  return result.explicitAcks;
}

async function storedCounts(): Promise<{ objects: number; rows: number }> {
  const listed = await env.ARTIFACTS.list({ prefix: "submissions/" });
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM submissions").first<{ n: number }>();
  return { objects: listed.objects.length, rows: row?.n ?? 0 };
}

/** Returns true when a Workflow instance exists for the submission (instance ID = submission ID). */
async function workflowStarted(id: string): Promise<boolean> {
  try {
    await env.PUBLICATION_WORKFLOW.get(id);
    return true;
  } catch {
    return false;
  }
}

/** Wraps the real binding and counts each successful create. */
function countingEnv(): { testEnv: Env; created: () => number } {
  let n = 0;
  const testEnv = envWith({
    create: async (options?: WorkflowInstanceCreateOptions<PublicationParams>) => {
      const instance = await env.PUBLICATION_WORKFLOW.create(options);
      n += 1;
      return instance;
    },
  });
  return { testEnv, created: () => n };
}

function envWith(workflow: Partial<Workflow<PublicationParams>>): Env {
  return {
    DB: env.DB,
    ARTIFACTS: env.ARTIFACTS,
    EVALUATION_QUEUE: env.EVALUATION_QUEUE,
    PUBLICATION_WORKFLOW: workflow as Env["PUBLICATION_WORKFLOW"],
  };
}

// BDR-002: docs/bdr/002-health-endpoint.md
describe("BDR-002 GET /api/health", () => {
  it("reports ok as JSON when D1 answers", async () => {
    const response = await exports.default.fetch("http://example.com/api/health");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ status: "ok" });
  });
});

// BDR-001: docs/bdr/001-publish-only-approved-artifact.md
describe("BDR-001 AC-1 valid submission", () => {
  it("returns 202 with an id and the SHA-256 of the stored bytes", async () => {
    const html = "<html><body>Grüße — ✓</body></html>";
    const response = await submit({ title: "Hello", html });
    expect(response.status).toBe(202);
    const { id, sha256 } = await response.json<{ id: string; sha256: string }>();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);

    const object = await env.ARTIFACTS.get(submissionKey(id));
    if (!object) throw new Error("object missing");
    const bytes = await object.arrayBuffer();
    expect(new TextDecoder().decode(bytes)).toBe(html);
    expect(sha256).toBe(await sha256Hex(bytes));
    expect(await getSubmission(env.DB, id)).toMatchObject({ status: "submitted", sha256 });
  });
});

describe("BDR-001 AC-2 invalid submission stores nothing", () => {
  const cases: [string, string][] = [
    ["empty title", JSON.stringify({ title: "", html: GOOD_HTML })],
    ["missing fields", JSON.stringify({})],
    ["not JSON", "{not json"],
    ["not an object", JSON.stringify("text")],
    ["array", JSON.stringify([])],
    ["title too long", JSON.stringify({ title: "x".repeat(121), html: GOOD_HTML })],
    ["html too large", JSON.stringify({ title: "Big", html: "x".repeat(MAX_ARTIFACT_BYTES + 1) })],
    ["wrong types", JSON.stringify({ title: 1, html: 2 })],
  ];
  it.each(cases)("%s returns 400 with errors and writes nothing", async (_name, body) => {
    const before = await storedCounts();
    const response = await post(body);
    expect(response.status).toBe(400);
    const { errors } = await response.json<{ errors: string[] }>();
    expect(errors.length).toBeGreaterThan(0);
    expect(await storedCounts()).toEqual(before);
  });
});

describe("BDR-001 evaluation and publication", () => {
  it("AC-4 publishes an approved artifact with identical content", async () => {
    const id = await submitId("Good", GOOD_HTML);
    await using instance = await introspectWorkflowInstance(env.PUBLICATION_WORKFLOW, id);

    expect(await deliver(id)).toContain(`msg-${id}`);

    await instance.waitForStatus("complete");
    expect(await getSubmission(env.DB, id)).toMatchObject({ status: "published" });
    expect(await (await env.ARTIFACTS.get(publishedKey(id)))?.text()).toBe(GOOD_HTML);
  });

  it("AC-3 rejects with reasons and starts no Workflow", async () => {
    const id = await submitId("Bad", BAD_HTML);

    await deliver(id);

    expect(await getSubmission(env.DB, id)).toMatchObject({
      status: "rejected",
      reasons: ["artifact must not contain <script> elements"],
    });
    expect(await workflowStarted(id)).toBe(false);
  });

  it("AC-5 fails when the stored artifact changed after submission", async () => {
    const id = await submitId("Swap", GOOD_HTML);
    await env.ARTIFACTS.put(submissionKey(id), "<html><body>different</body></html>");

    await deliver(id);

    expect(await getSubmission(env.DB, id)).toMatchObject({ status: "failed" });
    expect(await workflowStarted(id)).toBe(false);
    expect(await env.ARTIFACTS.get(publishedKey(id))).toBeNull();
  });

  it("AC-5 does not approve bad content that was swapped for good content before evaluation", async () => {
    const id = await submitId("Attack", BAD_HTML);
    await env.ARTIFACTS.put(submissionKey(id), GOOD_HTML);

    await deliver(id);
    await env.ARTIFACTS.put(submissionKey(id), BAD_HTML);

    expect(await getSubmission(env.DB, id)).toMatchObject({ status: "failed" });
    expect(await workflowStarted(id)).toBe(false);
    expect(await env.ARTIFACTS.get(publishedKey(id))).toBeNull();
  });

  it("AC-5 the Workflow refuses bytes that do not match the approved hash", async () => {
    const id = await submitId("Direct", GOOD_HTML);
    await using instance = await introspectWorkflowInstance(env.PUBLICATION_WORKFLOW, id);
    await env.DB.prepare("UPDATE submissions SET status = 'approved' WHERE id = ?").bind(id).run();

    await env.PUBLICATION_WORKFLOW.create({ id, params: { id, approvedSha256: "0".repeat(64) } });

    await instance.waitForStatus("errored");
    expect(await getSubmission(env.DB, id)).toMatchObject({
      status: "failed",
      reasons: ["artifact hash does not match the approved hash"],
    });
    expect(await env.ARTIFACTS.get(publishedKey(id))).toBeNull();
  });

  it("sets failed when the artifact is missing at publication time", async () => {
    const id = await submitId("Missing", GOOD_HTML);
    await using instance = await introspectWorkflowInstance(env.PUBLICATION_WORKFLOW, id);
    const sha256 = (await getSubmission(env.DB, id))?.sha256 ?? "";
    await env.DB.prepare("UPDATE submissions SET status = 'approved' WHERE id = ?").bind(id).run();
    await env.ARTIFACTS.delete(submissionKey(id));

    await env.PUBLICATION_WORKFLOW.create({ id, params: { id, approvedSha256: sha256 } });

    await instance.waitForStatus("errored");
    expect(await getSubmission(env.DB, id)).toMatchObject({ status: "failed" });
  });

  it("sets failed when a publication step fails on every retry", async () => {
    const id = await submitId("Retries", GOOD_HTML);
    await using instance = await introspectWorkflowInstance(env.PUBLICATION_WORKFLOW, id);
    await instance.modify(async (m) => {
      await m.disableRetryDelays();
      await m.mockStepError({ name: "verify and copy" }, new Error("R2 unavailable"));
    });

    await deliver(id);

    await instance.waitForStatus("errored");
    expect(await getSubmission(env.DB, id)).toMatchObject({
      status: "failed",
      reasons: ["publication failed after retries"],
    });
    expect(await env.ARTIFACTS.get(publishedKey(id))).toBeNull();
  });

  it("sets failed when the artifact is missing at evaluation time", async () => {
    const id = await submitId("Gone", GOOD_HTML);
    await env.ARTIFACTS.delete(submissionKey(id));

    await deliver(id);

    expect(await getSubmission(env.DB, id)).toMatchObject({
      status: "failed",
      reasons: ["artifact is missing from storage"],
    });
  });
});

describe("BDR-001 AC-6 duplicate delivery", () => {
  it("a sequential redelivery starts one Workflow", async () => {
    const id = await submitId("Twice", GOOD_HTML);
    const { testEnv, created } = countingEnv();

    await deliver(id, testEnv);
    await deliver(id, testEnv);

    expect(created()).toBe(1);
  });

  it("concurrent deliveries with different message ids start one Workflow and both ack", async () => {
    const id = await submitId("Concurrent", GOOD_HTML);
    const { testEnv, created } = countingEnv();

    const [a, b] = await Promise.all([deliver(id, testEnv, "m-a"), deliver(id, testEnv, "m-b")]);

    expect([...a, ...b].sort()).toEqual(["m-a", "m-b"]);
    expect(created()).toBe(1);
  });

  it("treats a failed create as success when the instance exists, whatever the error text", async () => {
    const id = await submitId("Exists", GOOD_HTML);
    const existing = envWith({
      create: async () => {
        throw new Error("some error text the code must not parse");
      },
      get: async () => ({}) as WorkflowInstance,
    });

    expect(await deliver(id, existing)).toContain(`msg-${id}`);
    expect(await getSubmission(env.DB, id)).toMatchObject({ status: "approved" });
  });

  it("retries when create fails and no instance exists, even if the text says already_exists", async () => {
    const id = await submitId("NotExists", GOOD_HTML);
    const missing = envWith({
      create: async () => {
        throw new Error("(instance.already_exists) Instance already exists");
      },
      get: async () => {
        throw new Error("instance.not_found");
      },
    });

    expect(await deliver(id, missing)).not.toContain(`msg-${id}`);
  });

  it("recovers a submission that was approved when the Workflow could not start", async () => {
    const id = await submitId("Recover", GOOD_HTML);
    await using instance = await introspectWorkflowInstance(env.PUBLICATION_WORKFLOW, id);
    const broken = envWith({
      create: async () => {
        throw new Error("transient failure");
      },
    });

    expect(await deliver(id, broken)).not.toContain(`msg-${id}`);
    expect(await getSubmission(env.DB, id)).toMatchObject({ status: "approved" });

    await deliver(id);

    await instance.waitForStatus("complete");
    expect(await getSubmission(env.DB, id)).toMatchObject({ status: "published" });
  });
});

// ADR-010: docs/adr/010-dead-letter-consumer-and-local-only-top-level-config.md
describe("ADR-010 dead-letter consumer", () => {
  async function deadLetter(id: string): Promise<string[]> {
    const batch = createMessageBatch<EvaluationMessage>("stack-cloudflare-evaluations-dlq", [
      { id: `dlq-${id}`, timestamp: new Date(), attempts: 4, body: { id } },
    ]);
    const ctx = createExecutionContext();
    await worker.queue(batch, env, ctx);
    return (await getQueueResult(batch, ctx)).explicitAcks;
  }

  it("marks a submitted submission failed and acks", async () => {
    const id = await submitId("DeadSubmitted", GOOD_HTML);
    expect(await deadLetter(id)).toContain(`dlq-${id}`);
    expect(await getSubmission(env.DB, id)).toMatchObject({
      status: "failed",
      reasons: ["evaluation failed after all retries"],
    });
  });

  it("marks an approved submission failed", async () => {
    const id = await submitId("DeadApproved", GOOD_HTML);
    await env.DB.prepare("UPDATE submissions SET status = 'approved' WHERE id = ?").bind(id).run();
    await deadLetter(id);
    expect(await getSubmission(env.DB, id)).toMatchObject({ status: "failed" });
  });

  it("does not change a final status", async () => {
    const id = await submitId("DeadPublished", GOOD_HTML);
    await env.DB.prepare("UPDATE submissions SET status = 'published' WHERE id = ?").bind(id).run();
    await deadLetter(id);
    expect(await getSubmission(env.DB, id)).toMatchObject({ status: "published" });
  });

  it("acks a message for an unknown submission", async () => {
    expect(await deadLetter(UNKNOWN_ID)).toContain(`dlq-${UNKNOWN_ID}`);
  });
});

// BDR-003: docs/bdr/003-published-artifact-retrieval.md
describe("BDR-003 published artifact retrieval", () => {
  it("serves a published artifact as plain text with nosniff", async () => {
    const id = await submitId("Serve", GOOD_HTML);
    await using instance = await introspectWorkflowInstance(env.PUBLICATION_WORKFLOW, id);
    await deliver(id);
    await instance.waitForStatus("complete");

    const response = await exports.default.fetch(`http://example.com/api/submissions/${id}/artifact`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toBe(GOOD_HTML);
  });

  it("returns 404 for a submission that is not published", async () => {
    const id = await submitId("Pending", GOOD_HTML);
    const response = await exports.default.fetch(`http://example.com/api/submissions/${id}/artifact`);
    expect(response.status).toBe(404);
  });

  it("returns 404 for an unknown id", async () => {
    const response = await exports.default.fetch(`http://example.com/api/submissions/${UNKNOWN_ID}/artifact`);
    expect(response.status).toBe(404);
  });

  it("returns 404 when the published bytes do not carry the approved hash", async () => {
    const id = await submitId("Tamper", GOOD_HTML);
    await env.DB.prepare("UPDATE submissions SET status = 'published' WHERE id = ?").bind(id).run();
    await env.ARTIFACTS.put(publishedKey(id), "<html>tampered</html>", { customMetadata: { sha256: "0".repeat(64) } });

    const response = await exports.default.fetch(`http://example.com/api/submissions/${id}/artifact`);
    expect(response.status).toBe(404);
  });
});

// BDR-004: docs/bdr/004-submission-status-visibility.md
describe("BDR-004 submission status visibility", () => {
  it("returns one submission with all fields", async () => {
    const response = await submit({ title: "Visible", html: GOOD_HTML });
    const { id, sha256 } = await response.json<{ id: string; sha256: string }>();

    const one = await exports.default.fetch(`http://example.com/api/submissions/${id}`);
    expect(one.status).toBe(200);
    const item = await one.json<Record<string, unknown>>();
    expect(item).toMatchObject({ id, sha256, title: "Visible", status: "submitted", reasons: [], publishedAt: null });
    expect(typeof item.createdAt).toBe("string");
  });

  it("returns 404 for an unknown id", async () => {
    const response = await exports.default.fetch(`http://example.com/api/submissions/${UNKNOWN_ID}`);
    expect(response.status).toBe(404);
  });

  it("lists at most 50 submissions, newest first", async () => {
    for (let i = 0; i < 3; i += 1) await submitId(`List ${i}`, GOOD_HTML);
    const response = await exports.default.fetch("http://example.com/api/submissions");
    expect(response.status).toBe(200);
    const { submissions } = await response.json<{ submissions: { createdAt: string; status: string }[] }>();
    expect(submissions.length).toBeGreaterThanOrEqual(3);
    expect(submissions.length).toBeLessThanOrEqual(50);
    const dates = submissions.map((s) => s.createdAt);
    expect([...dates].sort().reverse()).toEqual(dates);
    for (const s of submissions) {
      expect(["submitted", "approved", "rejected", "published", "failed"]).toContain(s.status);
    }
  });
});
