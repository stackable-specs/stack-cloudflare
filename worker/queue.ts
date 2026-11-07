import { evaluateArtifact, submissionKey } from "./domain/submission";
import type { Env, EvaluationMessage } from "./env";
import { getSubmission, updateStatus } from "./repository";

/** Evaluates each submission. Approved submissions start the publication Workflow. */
export async function handleEvaluationBatch(
  batch: MessageBatch<EvaluationMessage>,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      await evaluateOne(message.body.id, env);
      message.ack();
    } catch (error) {
      console.error("evaluation failed", { id: message.body.id, error: String(error) });
      message.retry();
    }
  }
}

async function evaluateOne(id: string, env: Env): Promise<void> {
  const submission = await getSubmission(env.DB, id);
  // Duplicate delivery is normal for queues. Only evaluate a submission one time.
  if (!submission || submission.status !== "submitted") {
    return;
  }
  const object = await env.ARTIFACTS.get(submissionKey(id));
  if (!object) {
    await updateStatus(env.DB, id, "failed", { reasons: ["artifact is missing from storage"] });
    return;
  }
  const evaluation = evaluateArtifact(await object.text());
  if (!evaluation.approved) {
    await updateStatus(env.DB, id, "rejected", { reasons: evaluation.reasons });
    return;
  }
  await updateStatus(env.DB, id, "approved", { reasons: [] });
  // The instance ID is the submission ID, so a duplicate create cannot publish twice.
  await env.PUBLICATION_WORKFLOW.create({ id, params: { id, approvedSha256: submission.sha256 } });
}
