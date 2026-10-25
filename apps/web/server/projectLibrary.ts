import type { LibraryIndex } from "../src/types/projectLibrary.js";
import { mkdir, readdir, readFile, rename, writeFile, unlink, access } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, Connect } from "vite";
import * as Y from "yjs";
import { deserializeTalwegFile, serializeTalwegFile, yDocToDocument } from "@talweg/storage";

function validId(id: string): boolean { return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id); }

export class ProjectLibrary {
  private readonly writes = new Map<string, Promise<unknown>>();
  constructor(readonly directory: string) {}

  async scan(): Promise<LibraryIndex> {
    await mkdir(this.directory, { recursive: true });
    await mkdir(join(this.directory, ".deleted"), { recursive: true });
    const deletedIds = (await readdir(join(this.directory, ".deleted"))).filter(validId);
    const projects: LibraryIndex["projects"] = [];
    const issues: string[] = [];
    const files = (await readdir(this.directory, { withFileTypes: true })).filter(file => file.isFile() && file.name.endsWith(".talweg"));
    for (const file of files.sort((a, b) => a.name.localeCompare(b.name))) {
      let scene: ReturnType<typeof deserializeTalwegFile> | undefined;
      try {
        const parsed: unknown = JSON.parse(await readFile(join(this.directory, file.name), "utf8"));
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("Invalid project file");
        scene = deserializeTalwegFile({ ...parsed, assets: {} });
        if (deletedIds.includes(scene.doc.id)) continue;
        if (!validId(scene.doc.id) || projects.some(project => project.documentId === scene?.doc.id)) throw new Error("Duplicate or invalid project id");
        projects.push({ documentId: scene.doc.id, name: scene.doc.name, createdAt: scene.doc.meta.createdAt, updatedAt: scene.doc.meta.updatedAt, schemaVersion: 1, nodeCount: Object.keys(scene.doc.nodes).length, filename: file.name });
      } catch { issues.push(file.name); }
      finally { scene?.ydoc.destroy(); }
    }
    return { directory: this.directory, projects, issues, deletedIds };
  }

  delete(id: string): Promise<void> {
    const task = (this.writes.get(id) ?? Promise.resolve()).catch(() => undefined).then(async () => {
      if (!validId(id)) throw new Error("Invalid project id");
      const index = await this.scan();
      const entry = index.projects.find(project => project.documentId === id);
      const marker = join(this.directory, ".deleted", id);
      await writeFile(marker, "");
      try { if (entry) await unlink(join(this.directory, entry.filename)); }
      catch (error) { await unlink(marker); throw error; }
    });
    this.writes.set(id, task);
    void task.finally(() => { if (this.writes.get(id) === task) this.writes.delete(id); }).catch(() => undefined);
    return task;
  }

  async read(id: string): Promise<string | null> {
    if (!validId(id)) throw new Error("Invalid project id");
    const entry = (await this.scan()).projects.find(project => project.documentId === id);
    return entry ? readFile(join(this.directory, entry.filename), "utf8") : null;
  }

  save(id: string, source: string): Promise<string> {
    const task = (this.writes.get(id) ?? Promise.resolve()).catch(() => undefined).then(async () => {
      if (!validId(id)) throw new Error("Invalid project id");
      if (await access(join(this.directory, ".deleted", id)).then(() => true, () => false)) throw new Error("Project was deleted");
      const incoming = deserializeTalwegFile(source);
      try {
        if (incoming.doc.id !== id || yDocToDocument(incoming.ydoc).id !== id) throw new Error("Project id mismatch");
        const index = await this.scan();
        const entry = index.projects.find(project => project.documentId === id);
        const filename = entry?.filename ?? `${id}.talweg`;
        const assets = { ...incoming.assets };
        if (entry) {
          const existing = deserializeTalwegFile(await readFile(join(this.directory, filename), "utf8"));
          try {
            Y.applyUpdate(incoming.ydoc, Y.encodeStateAsUpdate(existing.ydoc));
            Object.assign(assets, existing.assets, incoming.assets);
          } finally { existing.ydoc.destroy(); }
        } else {
          // an unreadable canonical file must never be replaced by a browser cache
          if (index.issues.includes(filename)) throw new Error("Project file needs recovery");
        }
        const doc = yDocToDocument(incoming.ydoc);
        const content = serializeTalwegFile({ ...doc, meta: { ...doc.meta, updatedAt: Date.now() } }, incoming.ydoc, assets);
        const temporary = join(this.directory, `.${id}-${randomUUID()}.tmp`);
        await writeFile(temporary, content, { flag: "wx", mode: 0o600 });
        await rename(temporary, join(this.directory, filename));
        return content;
      } finally { incoming.ydoc.destroy(); }
    });
    this.writes.set(id, task);
    void task.finally(() => { if (this.writes.get(id) === task) this.writes.delete(id); }).catch(() => undefined);
    return task;
  }
}

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
