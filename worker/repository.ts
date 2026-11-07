import type { SubmissionStatus } from "./domain/submission";

export interface SubmissionRow {
  id: string;
  title: string;
  sha256: string;
  status: SubmissionStatus;
  reasons: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface Submission {
  id: string;
  title: string;
  sha256: string;
  status: SubmissionStatus;
  reasons: string[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export function toSubmission(row: SubmissionRow): Submission {
  return {
    id: row.id,
    title: row.title,
    sha256: row.sha256,
    status: row.status,
    reasons: JSON.parse(row.reasons) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

export async function insertSubmission(
  db: D1Database,
  s: { id: string; title: string; sha256: string; now: string },
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO submissions (id, title, sha256, status, created_at, updated_at) VALUES (?, ?, ?, 'submitted', ?, ?)",
    )
    .bind(s.id, s.title, s.sha256, s.now, s.now)
    .run();
}

export async function getSubmission(db: D1Database, id: string): Promise<Submission | null> {
  const row = await db.prepare("SELECT * FROM submissions WHERE id = ?").bind(id).first<SubmissionRow>();
  return row ? toSubmission(row) : null;
}

export async function listSubmissions(db: D1Database, limit = 50): Promise<Submission[]> {
  const { results } = await db
    .prepare("SELECT * FROM submissions ORDER BY created_at DESC LIMIT ?")
    .bind(limit)
    .all<SubmissionRow>();
  return results.map(toSubmission);
}

export async function updateStatus(
  db: D1Database,
  id: string,
  status: SubmissionStatus,
  opts: { reasons?: string[]; publishedAt?: string } = {},
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      "UPDATE submissions SET status = ?, reasons = COALESCE(?, reasons), published_at = COALESCE(?, published_at), updated_at = ? WHERE id = ?",
    )
    .bind(status, opts.reasons ? JSON.stringify(opts.reasons) : null, opts.publishedAt ?? null, now, id)
    .run();
}
