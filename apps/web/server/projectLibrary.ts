import { ProjectLibrary } from "./projectFiles.js";
export { ProjectLibrary } from "./projectFiles.js";
import { resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, Connect } from "vite";
function validId(id: string): boolean { return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id); }

async function body(request: IncomingMessage): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > 100 * 1024 * 1024) throw new Error("Project exceeds 100 MB");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function middleware(library: ProjectLibrary): Connect.NextHandleFunction {
  return (request, response, next) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (!url.pathname.startsWith("/api/projects")) { next(); return; }
    const send = (status: number, value: unknown) => {
      response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      response.end(typeof value === "string" ? value : JSON.stringify(value));
    };
    const run = async (res: ServerResponse) => {
      const host = request.headers.host ?? "";
      const hostname = new URL(`http://${host}`).hostname;
      if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname) || (request.headers.origin && new URL(request.headers.origin).host !== host)) { send(403, { error: "Local requests only" }); return; }
      if (url.pathname === "/api/projects" && request.method === "GET") { send(200, await library.scan()); return; }
      const id = decodeURIComponent(url.pathname.slice("/api/projects/".length));
      if (!validId(id)) { send(400, { error: "Invalid project id" }); return; }
      if (request.method === "GET") {
        const content = await library.read(id);
        send(content ? 200 : 404, content ?? { error: "Project not found" });
      } else if (request.method === "PUT" && request.headers["content-type"]?.startsWith("application/json")) {
        send(200, await library.save(id, await body(request)));
      } else if (request.method === "DELETE") {
        await library.delete(id); send(200, { deleted: id });
      } else { res.setHeader("Allow", "GET, PUT, DELETE"); send(405, { error: "Method not allowed" }); }
    };
    void run(response).catch((error: unknown) => { console.error("[Talweg] Project library:", error); if (!response.headersSent) send(500, { error: "Project could not be read or saved" }); });
  };
}

export function projectLibraryPlugin(directory = process.env.TALWEG_PROJECTS_DIR ?? resolve(import.meta.dirname, "../../../projects")): Plugin {
  const library = new ProjectLibrary(directory);
  return {
    name: "talweg-project-library",
    configureServer(server) { server.middlewares.use(middleware(library)); server.watcher.add(directory);
      const changed = (path: string) => { if (path.startsWith(directory) && path.endsWith(".talweg")) server.ws.send({ type: "custom", event: "talweg:projects-changed", data: {} }); };
      server.watcher.on("add", changed); server.watcher.on("change", changed); server.watcher.on("unlink", changed); },
    configurePreviewServer(server) { server.middlewares.use(middleware(library)); },
  };
}
