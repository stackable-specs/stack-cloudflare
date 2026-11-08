import { evaluateArtifact, sha256Hex, submissionKey } from "./domain/submission";
import type { Env, EvaluationMessage } from "./env";
import { getSubmission, transitionStatus } from "./repository";

/** Evaluates each submission. Approved submissions start the publication Workflow (ADR-006). */
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

/** Returns true when a Workflow instance with this ID exists. */
async function instanceExists(env: Env, id: string): Promise<boolean> {
  try {
    await env.PUBLICATION_WORKFLOW.get(id);
    return true;
  } catch {
    return false;
  }
}

/**
 * Starts publication. The instance ID is the submission ID, so a second start is a no-op.
 * When `create` fails, the code looks up the instance. It does not parse the error text.
 */
async function startPublication(env: Env, id: string, approvedSha256: string): Promise<void> {
  try {
    await env.PUBLICATION_WORKFLOW.create({ id, params: { id, approvedSha256 } });
  } catch (error) {
    if (!(await instanceExists(env, id))) {
      throw error;
    }
  }
}

/**
 * Consumes the dead-letter queue (ADR-010). A message arrives here after all evaluation retries failed.
 * The submission becomes `failed` with a reason, so that no submission waits for an operator.
 */
export async function handleDeadLetterBatch(
  batch: MessageBatch<EvaluationMessage>,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  for (const message of batch.messages) {
    const { id } = message.body;
    console.error("evaluation dead-lettered", { id, attempts: message.attempts });
    const reasons = ["evaluation failed after all retries"];
    await transitionStatus(env.DB, id, "submitted", "failed", { reasons });
    await transitionStatus(env.DB, id, "approved", "failed", { reasons });
    message.ack();
  }
}

/** Sends each batch to the handler for its queue. */
export async function handleQueue(batch: MessageBatch<EvaluationMessage>, env: Env, ctx: ExecutionContext) {
  if (batch.queue.endsWith("-dlq")) {
    return handleDeadLetterBatch(batch, env, ctx);
  }
  return handleEvaluationBatch(batch, env, ctx);
}

async function evaluateOne(id: string, env: Env): Promise<void> {
  const submission = await getSubmission(env.DB, id);
  if (!submission) {
    return;
  }
  // Recovery: an earlier delivery approved the submission but could not start the Workflow.
  if (submission.status === "approved") {
    await startPublication(env, id, submission.sha256);
    return;
  }
  // Duplicate delivery is normal for queues. Only evaluate a submitted submission.
  if (submission.status !== "submitted") {
    return;
  }
  const object = await env.ARTIFACTS.get(submissionKey(id));
  if (!object) {
    await transitionStatus(env.DB, id, "submitted", "failed", { reasons: ["artifact is missing from storage"] });
    return;
  }
  // Hash and evaluate the same bytes, so the approved hash names the evaluated content.
  const bytes = await object.arrayBuffer();
  if ((await sha256Hex(bytes)) !== submission.sha256) {
    await transitionStatus(env.DB, id, "submitted", "failed", { reasons: ["artifact changed after submission"] });
    return;
  }
  const evaluation = evaluateArtifact(new TextDecoder().decode(bytes));
  if (!evaluation.approved) {
    await transitionStatus(env.DB, id, "submitted", "rejected", { reasons: evaluation.reasons });
    return;
  }
  if (!(await transitionStatus(env.DB, id, "submitted", "approved", { reasons: [] }))) {
    return; // A concurrent delivery already made the decision.
  }
  await startPublication(env, id, submission.sha256);
}
