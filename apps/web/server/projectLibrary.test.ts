import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as Y from "yjs";
import { createSceneDoc, applyDocumentToYDoc, serializeTalwegFile, deserializeTalwegFile } from "@talweg/storage";
import { createMicroservicesTemplate } from "../src/utils/starterTemplates.js";
import { ProjectLibrary } from "./projectLibrary.js";

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function library() { const directory = await mkdtemp(join(tmpdir(), "talweg-library-")); directories.push(directory); return new ProjectLibrary(directory); }
function fixture(id = "doc-library") {
  const doc = createMicroservicesTemplate(id);
  const scene = createSceneDoc();
  applyDocumentToYDoc(doc, scene);
  const content = serializeTalwegFile(doc, scene);
  scene.destroy();
  return { doc, content };
}

describe("project files", () => {
  it("survives a new store instance and discovers files copied into the folder", async () => {
    const store = await library();
    const first = fixture();
    await store.save(first.doc.id, first.content);
    const restarted = new ProjectLibrary(store.directory);
    expect((await restarted.scan()).projects.map(project => project.documentId)).toEqual([first.doc.id]);
    const dropped = fixture("doc-dropped");
    await writeFile(join(store.directory, "My diagram.talweg"), dropped.content);
    expect((await restarted.scan()).projects).toHaveLength(2);
    expect(await restarted.read(dropped.doc.id)).toBe(dropped.content);
  });
  it("merges simultaneous changes and preserves deletions from a stale browser", async () => {
    const store = await library();
    const initial = fixture();
    const first = deserializeTalwegFile(initial.content);
    const second = deserializeTalwegFile(initial.content);
    const id = initial.doc.rootNodeIds[0];
    if (!id) throw new Error("Fixture has no node");
    first.ydoc.getMap<Y.Map<unknown>>("nodes").get(id)?.set("x", 999);
    second.ydoc.getMap("documentMeta").set("name", "Renamed in another browser");
    try {
      await Promise.all([store.save(initial.doc.id, serializeTalwegFile(first.doc, first.ydoc)), store.save(initial.doc.id, serializeTalwegFile(second.doc, second.ydoc))]);
      const saved = deserializeTalwegFile(await store.read(initial.doc.id) ?? "");
      try { expect(saved.doc.name).toBe("Renamed in another browser"); expect(saved.doc.nodes[id]?.x).toBe(999); } finally { saved.ydoc.destroy(); }
      first.ydoc.getMap("nodes").delete(id);
      await store.save(initial.doc.id, serializeTalwegFile(first.doc, first.ydoc));
      await store.save(initial.doc.id, serializeTalwegFile(second.doc, second.ydoc));
      const deleted = deserializeTalwegFile(await store.read(initial.doc.id) ?? "");
      try { expect(deleted.doc.nodes[id]).toBeUndefined(); } finally { deleted.ydoc.destroy(); }
    } finally { first.ydoc.destroy(); second.ydoc.destroy(); }
  });
  it("reports corrupt files, keeps their bytes and still lists other projects", async () => {
    const store = await library();
    const valid = fixture();
    await store.save(valid.doc.id, valid.content);
    await writeFile(join(store.directory, "doc-broken.talweg"), "broken original");
    expect((await store.scan()).issues).toEqual(["doc-broken.talweg"]);
    const replacement = fixture("doc-broken");
    await expect(store.save(replacement.doc.id, replacement.content)).rejects.toThrow("needs recovery");
    expect(await readFile(join(store.directory, "doc-broken.talweg"), "utf8")).toBe("broken original");
    expect((await store.scan()).projects).toHaveLength(1);
  });
  it("rejects path traversal and mismatched document ids", async () => {
    const store = await library();
    const valid = fixture();
    await expect(store.save("../outside", valid.content)).rejects.toThrow("Invalid project id");
    await expect(store.save("doc-another", valid.content)).rejects.toThrow("id mismatch");
    expect((await store.scan()).projects).toHaveLength(0);
  });
  it("deletes the file after queued writes and rejects stale browser saves", async () => {
    const store = await library();
    const first = fixture();
    const other = fixture("doc-kept");
    await store.save(other.doc.id, other.content);
    await Promise.all([store.save(first.doc.id, first.content), store.delete(first.doc.id)]);
    expect(await store.read(first.doc.id)).toBeNull();
    await expect(readFile(join(store.directory, `${first.doc.id}.talweg`))).rejects.toMatchObject({ code: "ENOENT" });
    const restarted = new ProjectLibrary(store.directory);
    await expect(restarted.save(first.doc.id, first.content)).rejects.toThrow("Project was deleted");
    expect((await restarted.scan()).deletedIds).toEqual([first.doc.id]);
    expect(await restarted.read(other.doc.id)).not.toBeNull();
    await expect(store.delete("../outside")).rejects.toThrow("Invalid project id");
  });
});
