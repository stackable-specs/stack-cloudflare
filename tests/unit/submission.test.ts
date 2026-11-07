import { describe, expect, it } from "vitest";
import {
  MAX_ARTIFACT_BYTES,
  evaluateArtifact,
  parseSubmission,
  publishedKey,
  sha256Hex,
  submissionKey,
} from "../../worker/domain/submission";

describe("parseSubmission", () => {
  it("accepts a title and html", () => {
    expect(parseSubmission({ title: " Hello ", html: "<html></html>" })).toEqual({
      ok: true,
      value: { title: "Hello", html: "<html></html>" },
    });
  });

  it("rejects a body that is not an object", () => {
    expect(parseSubmission(null)).toEqual({ ok: false, errors: ["body must be a JSON object"] });
  });

  it("reports every missing field", () => {
    expect(parseSubmission({})).toEqual({ ok: false, errors: ["title is required", "html is required"] });
  });

  it("rejects an artifact that is too large", () => {
    const result = parseSubmission({ title: "Big", html: "x".repeat(MAX_ARTIFACT_BYTES + 1) });
    expect(result.ok).toBe(false);
  });
});

describe("evaluateArtifact", () => {
  it("approves a static HTML document", () => {
    expect(evaluateArtifact("<html><body>ok</body></html>")).toEqual({ approved: true, reasons: [] });
  });

  it("rejects a document with a script element", () => {
    const result = evaluateArtifact("<html><script>alert(1)</script></html>");
    expect(result.approved).toBe(false);
    expect(result.reasons).toContain("artifact must not contain <script> elements");
  });

  it("rejects content without an html element", () => {
    expect(evaluateArtifact("just text").approved).toBe(false);
  });
});

describe("sha256Hex", () => {
  it("returns the known digest of an empty string", async () => {
    expect(await sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});

describe("storage keys", () => {
  it("keeps submitted and published artifacts in separate prefixes", () => {
    expect(submissionKey("a")).toBe("submissions/a/index.html");
    expect(publishedKey("a")).toBe("published/a/index.html");
  });
});
