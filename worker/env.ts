export interface EvaluationMessage {
  id: string;
}

export interface PublicationParams {
  id: string;
  /** The SHA-256 hash that the evaluation approved. Publication must match this hash. */
  approvedSha256: string;
}

export interface Env {
  DB: D1Database;
  ARTIFACTS: R2Bucket;
  EVALUATION_QUEUE: Queue<EvaluationMessage>;
  PUBLICATION_WORKFLOW: Workflow<PublicationParams>;
}

// Make `env` from "cloudflare:workers" (and from "cloudflare:test") use the typed bindings above.
type AppEnv = Env;

declare global {
  namespace Cloudflare {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Env extends AppEnv {}
    interface GlobalProps {
      mainModule: typeof import("./index");
    }
  }
}
