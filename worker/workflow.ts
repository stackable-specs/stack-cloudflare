import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { publishedKey, sha256Hex, submissionKey } from "./domain/submission";
import type { Env, PublicationParams } from "./env";
import { updateStatus } from "./repository";

/** Publishes an approved artifact. It refuses an artifact that differs from the approved one. */
export class PublicationWorkflow extends WorkflowEntrypoint<Env, PublicationParams> {
  override async run(event: WorkflowEvent<PublicationParams>, step: WorkflowStep): Promise<{ key: string }> {
    const { id, approvedSha256 } = event.payload;

    await step.do("verify artifact hash", async () => {
      const object = await this.env.ARTIFACTS.get(submissionKey(id));
      if (!object) {
        await updateStatus(this.env.DB, id, "failed", { reasons: ["artifact is missing from storage"] });
        throw new NonRetryableError("artifact is missing");
      }
      const actual = await sha256Hex(await object.arrayBuffer());
      if (actual !== approvedSha256) {
        await updateStatus(this.env.DB, id, "failed", { reasons: ["artifact hash does not match the approved hash"] });
        throw new NonRetryableError("artifact hash mismatch");
      }
      return { sha256: actual };
    });

    const key = await step.do("copy to published", { retries: { limit: 3, delay: "1 second" } }, async () => {
      const source = await this.env.ARTIFACTS.get(submissionKey(id));
      if (!source) {
        throw new NonRetryableError("artifact is missing");
      }
      const target = publishedKey(id);
      await this.env.ARTIFACTS.put(target, await source.arrayBuffer(), {
        httpMetadata: { contentType: "text/html; charset=utf-8" },
        customMetadata: { sha256: approvedSha256 },
      });
      return target;
    });

    await step.do("mark published", async () => {
      await updateStatus(this.env.DB, id, "published", { publishedAt: new Date().toISOString() });
    });

    return { key };
  }
}
