import { parseSubmission, publishedKey, sha256Hex, submissionKey } from "./domain/submission";
import type { Env, EvaluationMessage } from "./env";
import { handleQueue } from "./queue";
import { getSubmission, insertSubmission, listSubmissions, transitionStatus } from "./repository";

export { PublicationWorkflow } from "./workflow";

const json = (data: unknown, status = 200): Response => Response.json(data, { status });

async function handleFetch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/health" && request.method === "GET") {
    const db = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    return json({ status: db?.ok === 1 ? "ok" : "degraded" });
  }

  if (path === "/api/submissions" && request.method === "GET") {
    return json({ submissions: await listSubmissions(env.DB) });
  }

  if (path === "/api/submissions" && request.method === "POST") {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ errors: ["body must be valid JSON"] }, 400);
    }
    const parsed = parseSubmission(body);
    if (!parsed.ok) {
      return json({ errors: parsed.errors }, 400);
    }
    const id = crypto.randomUUID();
    const sha256 = await sha256Hex(parsed.value.html);
    await env.ARTIFACTS.put(submissionKey(id), parsed.value.html, {
      httpMetadata: { contentType: "text/html; charset=utf-8" },
      customMetadata: { sha256 },
    });
    try {
      await insertSubmission(env.DB, { id, title: parsed.value.title, sha256, now: new Date().toISOString() });
    } catch (error) {
      // Remove the object, so a failed request stores nothing.
      await env.ARTIFACTS.delete(submissionKey(id));
      console.error("insert failed", { id, error: String(error) });
      return json({ errors: ["could not store the submission"] }, 503);
    }
    try {
      await env.EVALUATION_QUEUE.send({ id });
    } catch (error) {
      await transitionStatus(env.DB, id, "submitted", "failed", { reasons: ["could not enqueue the evaluation"] });
      console.error("enqueue failed", { id, error: String(error) });
      return json({ errors: ["could not enqueue the submission"] }, 503);
    }
    return json({ id, sha256, status: "submitted" }, 202);
  }

  const match = /^\/api\/submissions\/([0-9a-f-]{36})(\/artifact)?$/.exec(path);
  if (match && request.method === "GET") {
    const id = match[1] as string;
    const submission = await getSubmission(env.DB, id);
    if (!submission) {
      return json({ errors: ["submission not found"] }, 404);
    }
    if (!match[2]) {
      return json(submission);
    }
    if (submission.status !== "published") {
      return json({ errors: ["submission is not published"] }, 404);
    }
    const object = await env.ARTIFACTS.get(publishedKey(id));
    // Serve only the bytes whose hash was approved.
    if (!object || object.customMetadata?.sha256 !== submission.sha256) {
      return json({ errors: ["published artifact not found"] }, 404);
    }
    // Serve as plain text. The Worker does not render untrusted HTML on its own origin.
    return new Response(object.body, {
      headers: { "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff" },
    });
  }

  if (path.startsWith("/api/")) {
    return json({ errors: ["not found"] }, 404);
  }
  return new Response(null, { status: 404 });
}

export default {
  fetch: handleFetch,
  queue: handleQueue,
} satisfies ExportedHandler<Env, EvaluationMessage>;
