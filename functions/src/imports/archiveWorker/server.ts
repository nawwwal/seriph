import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { handleArchive, productionArchiveWorkerDependencies, type ArchiveWorkerDependencies, type ArchiveWorkerRequest } from "./handleArchive";

const MAX_REQUEST_BYTES = 64 * 1024;
export class ArchiveRequestTooLargeError extends Error { readonly status = 413; }

async function toArchiveRequest(req: IncomingMessage): Promise<ArchiveWorkerRequest> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.from(chunk as Uint8Array);
    size += bytes.byteLength;
    if (size > MAX_REQUEST_BYTES) throw new ArchiveRequestTooLargeError("archive task request is too large");
    chunks.push(bytes);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = text; }
  const headers: Record<string, string | string[] | undefined> = {};
  for (const [name, value] of Object.entries(req.headers)) headers[name] = value;
  return { body, headers };
}

export function createArchiveWorkerServer(deps: ArchiveWorkerDependencies = productionArchiveWorkerDependencies()): Server {
  return createServer(async (req, res) => {
    if (req.method !== "POST") {
      send(res, 400, { code: "method_not_allowed" });
      req.resume();
      return;
    }
    try {
      const result = await handleArchive(await toArchiveRequest(req), deps);
      send(res, result.status, result.body ?? {});
    } catch (error) {
      const status = error instanceof ArchiveRequestTooLargeError ? error.status : 503;
      send(res, status, { code: error instanceof Error ? error.message : "archive_worker_failure", ...(status === 503 ? { retryable: true } : {}) });
    }
  });
}

function send(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

export function startArchiveWorkerServer(port = Number(process.env.PORT ?? 8080), deps?: ArchiveWorkerDependencies): Server {
  const server = createArchiveWorkerServer(deps);
  server.listen(port);
  return server;
}

if (require.main === module) startArchiveWorkerServer();
