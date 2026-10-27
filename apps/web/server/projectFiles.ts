import { ProjectHistory } from "./projectHistory.js";
import { copyBoard } from "../src/utils/copyBoard.js";
import { createSceneDoc, applyDocumentToYDoc } from "@talweg/storage";
import type { DocumentId } from "@talweg/core";
import type { ProjectVersion } from "../src/types/projectHistory.js";
import type { LibraryIndex } from "../src/types/projectLibrary.js";
import { mkdir, readdir, readFile, rename, writeFile, unlink, access } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import * as Y from "yjs";
import { deserializeTalwegFile, serializeTalwegFile, yDocToDocument } from "@talweg/storage";

function validId(id: string): boolean { return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id); }

export class ProjectLibrary {
  private readonly writes = new Map<string, Promise<unknown>>();
  readonly history: ProjectHistory;
  constructor(readonly directory: string) { this.history = new ProjectHistory(join(directory, ".history")); }

  checkpoint(id: string, label: string): Promise<ProjectVersion> {
    const task = (this.writes.get(id) ?? Promise.resolve()).catch(() => undefined).then(async () => {
      const content = await this.read(id);
      if (!content) throw new Error("Project not found");
      const version = await this.history.record(id, content, label);
      if (!version) throw new Error("Checkpoint could not be saved");
      return version;
    });
    this.writes.set(id, task);
    void task.finally(() => { if (this.writes.get(id) === task) this.writes.delete(id); }).catch(() => undefined);
    return task;
  }

  async restore(id: string, versionId: string, name?: string): Promise<{ id: string }> {
    const source = deserializeTalwegFile(await this.history.read(id, versionId));
    const scene = createSceneDoc();
    try {
      const newId = `doc-${randomUUID()}` as DocumentId;
      const copy = copyBoard(source.doc, newId);
      const requestedName = name?.trim().slice(0, 200) ?? "";
      copy.name = requestedName.length > 0 ? requestedName : `${source.doc.name} (restored)`;
      applyDocumentToYDoc(copy, scene);
      await this.save(newId, serializeTalwegFile(copy, scene, source.assets));
      return { id: newId };
    } finally { scene.destroy(); source.ydoc.destroy(); }
  }

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
      await this.history.purge(id);
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
        try { await this.history.record(id, content); }
        catch { this.history.failures.add(id); }
        return content;
      } finally { incoming.ydoc.destroy(); }
    });
    this.writes.set(id, task);
    void task.finally(() => { if (this.writes.get(id) === task) this.writes.delete(id); }).catch(() => undefined);
    return task;
  }
}
