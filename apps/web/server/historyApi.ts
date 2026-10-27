import type { ProjectLibrary } from "./projectFiles.js";
import { validProjectId } from "../src/types/projectHistory.js";
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
async function objectBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > 65536) throw new Error("Invalid request");
  const body: unknown = JSON.parse(text);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid request");
  return body as Record<string, unknown>;
}
export async function historyApi(library: ProjectLibrary, request: Request): Promise<Response> {
  const path = new URL(request.url).pathname;
  try {
    if (path === "/api/history/settings") {
      if (request.method === "GET") return json(await library.history.policy());
      if (request.method === "PUT") return json(await library.history.savePolicy(await objectBody(request)));
      return json({ error: "Method not allowed" }, 405);
    }
    const parts = path.slice("/api/history/projects/".length).split("/").map(decodeURIComponent);
    const [id, versionId, action] = parts;
    if (!path.startsWith("/api/history/projects/") || !id || !validProjectId(id) || parts.length > 3 || (versionId !== undefined && !validProjectId(versionId))) return json({ error: "Invalid project or version id" }, 400);
    if (!versionId && request.method === "GET") return json(await library.history.list(id));
    if (!versionId && request.method === "POST") {
      const { label } = await objectBody(request);
      if (typeof label !== "string" || label.length > 100) return json({ error: "Invalid checkpoint label" }, 400);
      return json(await library.checkpoint(id, label), 201);
    }
    if (versionId && !action && request.method === "GET") return new Response(await library.history.read(id, versionId), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    if (versionId && action === "restore" && request.method === "POST") {
      const { name } = await objectBody(request);
      if (name !== undefined && (typeof name !== "string" || name.length > 200)) return json({ error: "Invalid project name" }, 400);
      return json(await library.restore(id, versionId, typeof name === "string" ? name : undefined), 201);
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (error) {
    const message = error instanceof Error ? error.message : "History unavailable";
    return json({ error: "Version history could not be read or saved" }, message.includes('not found') ? 404 : error instanceof SyntaxError || error instanceof URIError || /Invalid|Unexpected/.test(message) ? 400 : 500);
  }
}
