// A small node:http server that answers like the Worker API. Script tests use it as the target.
// It is not a binding mock: the scripts only see HTTP, the same as against the real dev server.
import http from "node:http";
import type { AddressInfo } from "node:net";

export interface FakeWorkerOptions {
  health?: string;
  postStatus?: number;
  statuses?: string[];
  artifactBody?: string;
  explorerStatus?: number;
  spaBody?: string;
}

export interface FakeWorker {
  base: string;
  posted: { title: string; html: string }[];
  close: () => Promise<void>;
}

const ID = "00000000-0000-4000-8000-000000000001";

export async function startFakeWorker(options: FakeWorkerOptions = {}): Promise<FakeWorker> {
  const posted: { title: string; html: string }[] = [];
  const statuses = [...(options.statuses ?? ["submitted", "approved", "published"])];
  const nextStatus = () => (statuses.length > 1 ? statuses.shift() : statuses[0]);
  const send = (res: http.ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString();
      const route = `${req.method} ${req.url}`;
      if (route === "GET /api/health") return send(res, 200, { status: options.health ?? "ok" });
      if (route === "POST /api/submissions") {
        const parsed = JSON.parse(body) as { title?: string; html?: string };
        if (!parsed.title || !parsed.html) return send(res, 400, { errors: ["title is required"] });
        posted.push({ title: parsed.title, html: parsed.html });
        return send(res, options.postStatus ?? 202, { id: ID, status: "submitted" });
      }
      if (route === `GET /api/submissions/${ID}`) return send(res, 200, { id: ID, status: nextStatus() });
      if (route === `GET /api/submissions/${ID}/artifact`) {
        res.writeHead(200, { "content-type": "text/plain" });
        return res.end(options.artifactBody ?? posted[0]?.html ?? "");
      }
      if (route === "GET /cdn-cgi/local/explorer") {
        res.writeHead(options.explorerStatus ?? 200);
        return res.end("explorer");
      }
      if (route === "GET /") {
        res.writeHead(200, { "content-type": "text/html" });
        return res.end(options.spaBody ?? '<div id="root"></div>');
      }
      return send(res, 404, { errors: ["not found"] });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}`,
    posted,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

export const FAKE_ID = ID;
