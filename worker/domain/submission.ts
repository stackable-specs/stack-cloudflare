// Pure domain rules. This module has no Cloudflare imports, so unit tests run in Node.js.

export const MAX_TITLE_LENGTH = 120;
export const MAX_ARTIFACT_BYTES = 512 * 1024;

export type SubmissionStatus = "submitted" | "approved" | "rejected" | "published" | "failed";

export interface SubmissionInput {
  title: string;
  html: string;
}

export interface Evaluation {
  approved: boolean;
  reasons: string[];
}

export type ParseResult = { ok: true; value: SubmissionInput } | { ok: false; errors: string[] };

export function parseSubmission(body: unknown): ParseResult {
  const errors: string[] = [];
  if (typeof body !== "object" || body === null) {
    return { ok: false, errors: ["body must be a JSON object"] };
  }
  const { title, html } = body as Record<string, unknown>;
  if (typeof title !== "string" || title.trim().length === 0) {
    errors.push("title is required");
  } else if (title.length > MAX_TITLE_LENGTH) {
    errors.push(`title must be ${MAX_TITLE_LENGTH} characters or fewer`);
  }
  if (typeof html !== "string" || html.trim().length === 0) {
    errors.push("html is required");
  } else if (new TextEncoder().encode(html).byteLength > MAX_ARTIFACT_BYTES) {
    errors.push(`html must be ${MAX_ARTIFACT_BYTES} bytes or fewer`);
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: { title: (title as string).trim(), html: html as string } };
}

/**
 * Deterministic evaluation rules for an artifact.
 * Replace these example rules with the real evaluation for your product.
 */
export function evaluateArtifact(html: string): Evaluation {
  const reasons: string[] = [];
  if (!/<html[\s>]/i.test(html)) {
    reasons.push("artifact must contain an <html> element");
  }
  if (/<script[\s>]/i.test(html)) {
    reasons.push("artifact must not contain <script> elements");
  }
  return { approved: reasons.length === 0, reasons };
}

export async function sha256Hex(content: string | ArrayBuffer): Promise<string> {
  const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function submissionKey(id: string): string {
  return `submissions/${id}/index.html`;
}

export function publishedKey(id: string): string {
  return `published/${id}/index.html`;
}
