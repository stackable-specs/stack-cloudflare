export interface Submission {
  id: string;
  title: string;
  sha256: string;
  status: "submitted" | "approved" | "rejected" | "published" | "failed";
  reasons: string[];
  createdAt: string;
  publishedAt: string | null;
}

export async function listSubmissions(): Promise<Submission[]> {
  const response = await fetch("/api/submissions");
  const data = (await response.json()) as { submissions: Submission[] };
  return data.submissions;
}

export async function createSubmission(title: string, html: string): Promise<{ errors?: string[] }> {
  const response = await fetch("/api/submissions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title, html }),
  });
  return response.ok ? {} : ((await response.json()) as { errors: string[] });
}
