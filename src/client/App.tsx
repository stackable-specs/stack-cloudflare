import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createSubmission, listSubmissions, type Submission } from "./api";

const SAMPLE = "<html><body><h1>Hello</h1></body></html>";

export function App() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [title, setTitle] = useState("");
  const [html, setHtml] = useState(SAMPLE);
  const [errors, setErrors] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    setSubmissions(await listSubmissions());
  }, []);

  useEffect(() => {
    let active = true;
    const poll = () => {
      void listSubmissions().then((next) => {
        if (active) setSubmissions(next);
      });
    };
    poll();
    const timer = setInterval(poll, 1500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await createSubmission(title, html);
    setErrors(result.errors ?? []);
    if (!result.errors) {
      setTitle("");
      await refresh();
    }
  }

  return (
    <main>
      <h1>stack-cloudflare</h1>
      <p>Submit an HTML artifact. A Queue evaluates it. A Workflow publishes it.</p>
      <form onSubmit={(e) => void onSubmit(e)}>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          HTML
          <textarea rows={5} value={html} onChange={(e) => setHtml(e.target.value)} />
        </label>
        <button type="submit">Submit</button>
        {errors.length > 0 && (
          <ul role="alert">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </form>
      <h2>Submissions</h2>
      <table aria-label="Submissions">
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Reasons</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((s) => (
            <tr key={s.id}>
              <td>{s.title}</td>
              <td data-testid={`status-${s.title}`}>{s.status}</td>
              <td>{s.reasons.join("; ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
