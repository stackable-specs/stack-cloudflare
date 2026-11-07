import { createExecutionContext, createMessageBatch, getQueueResult, introspectWorkflow } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { publishedKey, submissionKey } from "../../worker/domain/submission";
import type { EvaluationMessage } from "../../worker/env";
import worker from "../../worker/index";
import { getSubmission } from "../../worker/repository";

const GOOD_HTML = "<html><body><h1>Hello</h1></body></html>";

async function submit(body: unknown): Promise<Response> {
  return exports.default.fetch("http://example.com/api/submissions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function deliver(id: string): Promise<void> {
  const batch = createMessageBatch<EvaluationMessage>("stack-cloudflare-evaluations", [
    { id: `msg-${id}`, timestamp: new Date(), attempts: 1, body: { id } },
  ]);
  const ctx = createExecutionContext();
  await worker.queue(batch, env, ctx);
  const result = await getQueueResult(batch, ctx);
  expect(result.explicitAcks).toContain(`msg-${id}`);
}

describe("GET /api/health", () => {
  it("reports ok when D1 answers", async () => {
    const response = await exports.default.fetch("http://example.com/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});

describe("POST /api/submissions", () => {
  it("stores the artifact in R2 and the record in D1", async () => {
    const response = await submit({ title: "Hello", html: GOOD_HTML });
    expect(response.status).toBe(202);
    const { id, sha256 } = await response.json<{ id: string; sha256: string }>();

    const object = await env.ARTIFACTS.get(submissionKey(id));
    expect(await object?.text()).toBe(GOOD_HTML);
    expect(await getSubmission(env.DB, id)).toMatchObject({ status: "submitted", sha256 });
  });

  it("rejects invalid input with 400", async () => {
    const response = await submit({ title: "" });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ errors: ["title is required", "html is required"] });
  });
});

// BDR-001: docs/bdr/001-publish-only-approved-artifact.md
describe("evaluation and publication", () => {
  it("publishes an approved artifact through the Workflow", async () => {
    await using introspector = await introspectWorkflow(env.PUBLICATION_WORKFLOW);
    const { id } = await (await submit({ title: "Good", html: GOOD_HTML })).json<{ id: string }>();

    await deliver(id);

    const [instance] = await introspector.get();
    expect(instance).toBeDefined();
    await instance?.waitForStatus("complete");
    expect(await getSubmission(env.DB, id)).toMatchObject({ status: "published" });
    expect(await (await env.ARTIFACTS.get(publishedKey(id)))?.text()).toBe(GOOD_HTML);

    const artifact = await exports.default.fetch(`http://example.com/api/submissions/${id}/artifact`);
    expect(artifact.headers.get("content-type")).toContain("text/plain");
    expect(await artifact.text()).toBe(GOOD_HTML);
  });

  it("rejects an artifact that fails evaluation and does not start a Workflow", async () => {
    await using introspector = await introspectWorkflow(env.PUBLICATION_WORKFLOW);
    const { id } = await (
      await submit({ title: "Bad", html: "<html><script></script></html>" })
    ).json<{ id: string }>();

    await deliver(id);

    expect(await getSubmission(env.DB, id)).toMatchObject({ status: "rejected" });
    expect(await introspector.get()).toHaveLength(0);
  });

  it("evaluates a duplicate message only one time", async () => {
    await using introspector = await introspectWorkflow(env.PUBLICATION_WORKFLOW);
    const { id } = await (await submit({ title: "Twice", html: GOOD_HTML })).json<{ id: string }>();

    await deliver(id);
    await deliver(id);

    expect(await introspector.get()).toHaveLength(1);
  });

  it("does not publish an artifact that changed after approval", async () => {
    await using introspector = await introspectWorkflow(env.PUBLICATION_WORKFLOW);
    const { id } = await (await submit({ title: "Swap", html: GOOD_HTML })).json<{ id: string }>();
    // Replace the stored artifact after submission. The D1 record keeps the original hash.
    await env.ARTIFACTS.put(submissionKey(id), "<html><body>different</body></html>");

    await deliver(id);

    const [instance] = await introspector.get();
    expect(instance).toBeDefined();
    await instance?.waitForStatus("errored");
    expect(await getSubmission(env.DB, id)).toMatchObject({ status: "failed" });
    expect(await env.ARTIFACTS.get(publishedKey(id))).toBeNull();
  });
});
