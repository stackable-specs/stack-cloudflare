import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { publishedKey, sha256Hex, submissionKey } from "./domain/submission";
import type { Env, PublicationParams } from "./env";
import { transitionStatus } from "./repository";

/** Publishes an approved artifact. It refuses an artifact that differs from the approved one (ADR-006). */
export class PublicationWorkflow extends WorkflowEntrypoint<Env, PublicationParams> {
  override async run(event: WorkflowEvent<PublicationParams>, step: WorkflowStep): Promise<{ key: string }> {
    const { id, approvedSha256 } = event.payload;

    const fail = async (reason: string): Promise<never> => {
      await transitionStatus(this.env.DB, id, "approved", "failed", { reasons: [reason] });
      throw new NonRetryableError(reason);
    };

    try {
      // Read, verify, and copy ONE buffer in ONE step. No second read can publish other bytes.
      const key = await step.do("verify and copy", { retries: { limit: 3, delay: "1 second" } }, async () => {
        const object = await this.env.ARTIFACTS.get(submissionKey(id));
        if (!object) {
          return fail("artifact is missing from storage");
        }
        const bytes = await object.arrayBuffer();
        if ((await sha256Hex(bytes)) !== approvedSha256) {
          return fail("artifact hash does not match the approved hash");
        }
        const target = publishedKey(id);
        await this.env.ARTIFACTS.put(target, bytes, {
          httpMetadata: { contentType: "text/html; charset=utf-8" },
          customMetadata: { sha256: approvedSha256 },
        });
        return target;
      });

      await step.do("mark published", async () => {
        await transitionStatus(this.env.DB, id, "approved", "published", { publishedAt: new Date().toISOString() });
      });

      return { key };
    } catch (error) {
      // A step used all of its retries. Do not leave the submission in `approved` with no way to recover.
      if (!(error instanceof NonRetryableError)) {
        await transitionStatus(this.env.DB, id, "approved", "failed", {
          reasons: ["publication failed after retries"],
        });
      }
      throw error;
    }
  }
}
