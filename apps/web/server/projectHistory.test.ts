import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyDocumentToYDoc, createSceneDoc, deserializeTalwegFile, serializeTalwegFile } from "@talweg/storage";
import { createBlankCanvas, createMicroservicesTemplate } from "../src/utils/starterTemplates.js";
import { ProjectLibrary } from "./projectFiles.js";
import { createStarterTemplate } from "../src/utils/templateCatalog.js";
import { DEFAULT_HISTORY_POLICY } from "../src/types/projectHistory.js";
import { historyApi } from "./historyApi.js";

const directories: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true }))); });
async function library() { const directory = await mkdtemp(join(tmpdir(), "talweg-history-")); directories.push(directory); return new ProjectLibrary(directory); }
function fixture(id = "doc-history") {
  const doc = createMicroservicesTemplate(id);
  const scene = createSceneDoc(); applyDocumentToYDoc(doc, scene);
  const content = serializeTalwegFile(doc, scene); scene.destroy();
  return { doc, content };
}
function rename(source: string, name: string) {
  const snapshot = deserializeTalwegFile(source);
  try { snapshot.ydoc.getMap("documentMeta").set("name", name); return serializeTalwegFile({ ...snapshot.doc, name }, snapshot.ydoc, snapshot.assets); }
  finally { snapshot.ydoc.destroy(); }
}
describe("local project history", () => {
  it("keeps compressed versions across restarts without filling the project list", async () => {
    const store = await library(); const first = fixture();
    await store.save(first.doc.id, first.content);
    const restarted = new ProjectLibrary(store.directory);
    const index = await restarted.history.list(first.doc.id);
    expect(index.versions).toHaveLength(1);
    const version = index.versions[0]; if (!version) throw new Error("Missing automatic version");
    expect(version.kind).toBe("automatic");
    const recovered = deserializeTalwegFile(await restarted.history.read(first.doc.id, version.id));
    try { expect(recovered.doc.nodes).toEqual(first.doc.nodes); }
    finally { recovered.ydoc.destroy(); }
    expect(index.totalBytes).toBeLessThan(Buffer.byteLength(first.content));
    expect((await restarted.scan()).projects).toHaveLength(1);
  });
  it("respects the interval, skips unchanged saves and allows named checkpoints", async () => {
    const store = await library(); const first = fixture();
    const now = vi.spyOn(Date, "now").mockReturnValue(1000000);
    await store.save(first.doc.id, first.content);
    await store.save(first.doc.id, rename(first.content, "Second state"));
    expect((await store.history.list(first.doc.id)).versions).toHaveLength(1);
    now.mockReturnValue(1000000 + 6 * 60000);
    await store.save(first.doc.id, rename(first.content, "Third state"));
    expect((await store.history.list(first.doc.id)).versions).toHaveLength(2);
    now.mockReturnValue(1000000 + 12 * 60000);
    const current = await store.read(first.doc.id); if (!current) throw new Error("Missing current project");
    await store.save(first.doc.id, current);
    expect((await store.history.list(first.doc.id)).versions).toHaveLength(2);
    await store.checkpoint(first.doc.id, "Before review");
    expect((await store.history.list(first.doc.id)).versions[0]?.label).toBe("Before review");
  });
  it("bounds history and retains the newest state", async () => {
    const store = await library(); const first = fixture();
    await store.history.savePolicy({ ...DEFAULT_HISTORY_POLICY, maxVersions: 5 });
    await store.save(first.doc.id, first.content);
    for (let i = 0; i < 7; i++) await store.checkpoint(first.doc.id, `Checkpoint ${String(i)}`);
    const index = await store.history.list(first.doc.id);
    expect(index.versions).toHaveLength(5);
    expect(index.versions[0]?.label).toBe("Checkpoint 6");
    expect(await readdir(join(index.directory))).toHaveLength(5);
    expect(() => store.history.savePolicy({ ...DEFAULT_HISTORY_POLICY, intervalMinutes: 0 })).toThrow();
  });
  it("disabling automatic versions keeps existing ones and still permits a checkpoint", async () => {
    const store = await library(); const first = fixture();
    await store.save(first.doc.id, first.content);
    await store.history.savePolicy({ ...DEFAULT_HISTORY_POLICY, enabled: false });
    await store.save(first.doc.id, rename(first.content, "No automatic backup"));
    expect((await store.history.list(first.doc.id)).versions).toHaveLength(1);
    await store.checkpoint(first.doc.id, "Manual backup");
    expect((await store.history.list(first.doc.id)).versions).toHaveLength(2);
  });
  it("restores independently with pages, assets and rewritten internal links", async () => {
    const store = await library(); const first = fixture();
    const node = Object.values(first.doc.nodes)[0]; if (!node) throw new Error("Missing fixture node");
    node.note = `[Details](/board/${first.doc.id}/page/page-1?node=${node.id})`;
    const scene = createSceneDoc(); applyDocumentToYDoc(first.doc, scene);
    const source = serializeTalwegFile(first.doc, scene, { image: { mimeType: "image/png", data: new Uint8Array([4, 8, 12]) } }); scene.destroy();
    await store.save(first.doc.id, source);
    const version = await store.checkpoint(first.doc.id, "Original diagram");
    await store.save(first.doc.id, rename(source, "Current diagram"));
    const original = await readFile(join(store.directory, `${first.doc.id}.talweg`), "utf8");
    const restored = await store.restore(first.doc.id, version.id, "Restored review");
    const recovered = deserializeTalwegFile(await store.read(restored.id) ?? "");
    try {
      expect(recovered.doc.id).not.toBe(first.doc.id);
      expect(recovered.doc.name).toBe("Restored review");
      expect(recovered.doc.pages).toEqual(first.doc.pages);
      expect(recovered.doc.nodes[node.id]?.note).toContain(`/board/${restored.id}/`);
      expect(new Uint8Array(recovered.assets.image?.data ?? new ArrayBuffer(0))).toEqual(new Uint8Array([4, 8, 12]));
    } finally { recovered.ydoc.destroy(); }
    expect(await readFile(join(store.directory, `${first.doc.id}.talweg`), "utf8")).toBe(original);
  });
  it("restores named pages and their self-links from a multi-page checkpoint", async () => {
    const store = await library();
    const doc = createStarterTemplate("lesson", "en");
    const scene = createSceneDoc(); applyDocumentToYDoc(doc, scene);
    try { await store.save(doc.id, serializeTalwegFile(doc, scene)); }
    finally { scene.destroy(); }
    const version = await store.checkpoint(doc.id, "Lesson before editing");
    const copy = await store.restore(doc.id, version.id);
    const restored = deserializeTalwegFile(await store.read(copy.id) ?? "");
    try {
      expect(restored.doc.pages).toEqual(doc.pages);
      expect(restored.doc.activePageId).toBe(doc.activePageId);
      expect(Object.values(restored.doc.nodes).filter(node => node.pageId === "page-practice")).toHaveLength(6);
      const formula = Object.values(restored.doc.nodes).find(node => node.note?.includes("Go to practice"));
      expect(formula?.note).toContain(`/board/${copy.id}/page/page-practice?node=`);
      expect(formula?.note).not.toContain(`/board/${doc.id}/`);
    } finally { restored.ydoc.destroy(); }
  });
  it("keeps project saves working when history storage fails and reports it", async () => {
    const store = await library(); const first = fixture();
    await writeFile(join(store.directory, ".history"), "unavailable history directory");
    await store.save(first.doc.id, first.content);
    expect(await store.read(first.doc.id)).not.toBeNull();
    expect(store.history.failures.has(first.doc.id)).toBe(true);
    await rm(join(store.directory, ".history"));
    await store.checkpoint(first.doc.id, "Recovered history");
    expect(store.history.failures.has(first.doc.id)).toBe(false);
  });
  it("rejects corrupted versions and preserves their bytes", async () => {
    const store = await library(); const first = fixture();
    await store.save(first.doc.id, first.content);
    const version = await store.checkpoint(first.doc.id, "Keep original");
    const filename = join(store.history.directory, first.doc.id, version.id, "project.talweg.gz");
    await writeFile(filename, "damaged version");
    await expect(store.restore(first.doc.id, version.id)).rejects.toThrow();
    expect(await readFile(filename, "utf8")).toBe("damaged version");
    expect((await store.history.list(first.doc.id)).issues).toBe(1);
    expect((await store.scan()).projects).toHaveLength(1);
  });
  it("removes retained versions when a project is permanently deleted", async () => {
    const store = await library(); const first = fixture();
    await store.save(first.doc.id, first.content);
    await store.delete(first.doc.id);
    expect((await store.history.list(first.doc.id)).versions).toHaveLength(0);
  });
  it("validates API ids and settings and never restores to the source id", async () => {
    const store = await library(); const blank = createBlankCanvas("doc-empty");
    const scene = createSceneDoc(); applyDocumentToYDoc(blank, scene);
    await store.save(blank.id, serializeTalwegFile(blank, scene)); scene.destroy();
    expect((await historyApi(store, new Request("http://local/api/history/settings", { method: "PUT", body: '{}' }))).status).toBe(400);
    expect((await historyApi(store, new Request("http://local/api/history/projects/bad%2Fid"))).status).toBe(400);
    const created = await historyApi(store, new Request("http://local/api/history/projects/doc-empty", { method: "POST", body: JSON.stringify({ label: "Safe point" }) }));
    expect(created.status).toBe(201);
    const version = await created.json() as { id: string };
    const response = await historyApi(store, new Request(`http://local/api/history/projects/doc-empty/${version.id}/restore`, { method: "POST", body: '{}' }));
    expect(response.status).toBe(201);
    expect((await response.json() as { id: string }).id).not.toBe(blank.id);
  });
});
