import * as Y from "yjs";
import type { DocumentId } from "@talweg/core";
import { IndexedDBStorageAdapter, createSceneDoc, deserializeTalwegFile, serializeTalwegFile, yDocToDocument, type StorageSnapshot, type StorageDelta, uint8ArrayToBase64 } from "@talweg/storage";
import { templateDraftIds, promoteTemplateDraft, deletedBoardIds, markBoardDeleted } from "./boardLibrary.js";
import { STORAGE_DB_NAME } from "@talweg/storage";

import type { LibraryIndex, LibraryState } from "../types/projectLibrary.js";
export type { LibraryState } from "../types/projectLibrary.js";

async function request(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`/api/projects${path}`, { ...options, cache: "no-store", signal: AbortSignal.timeout(8000) });
}

const openAdapters = new Set<ProjectStorageAdapter>();
export async function flushProjectWrites(): Promise<void> {
  for (const adapter of openAdapters) {
    await adapter.flush();
    if (adapter.hasPendingWrites) throw new Error("Project files could not be saved");
  }
}
export class ProjectStorageAdapter extends IndexedDBStorageAdapter {
  library: LibraryIndex | null = null;
  private localWrites: Promise<void> = Promise.resolve();
  private readonly diskVersions = new Map<DocumentId, string>();
  private pending = new Set<DocumentId>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private writing: Promise<void> = Promise.resolve();
  private closing = false;
  private seen = new Set<string>();
  get hasPendingWrites(): boolean { return this.pending.size > 0; }
  private remember(ids: string[]): void {
    for (const id of ids) this.seen.add(id);
    try { localStorage.setItem(`talweg_library_seen:${this.library?.directory ?? ""}`, JSON.stringify([...this.seen])); } catch { /* the current session still tracks migrated projects */ }
  }
  constructor(private readonly onState?: (state: LibraryState) => void) { super(); openAdapters.add(this); }

  override async initialize(): Promise<void> {
    await super.initialize();
    try {
      const response = await request("");
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return;
      this.library = await response.json() as LibraryIndex;
      try {
        const saved: unknown = JSON.parse(localStorage.getItem(`talweg_library_seen:${this.library.directory}`) ?? "[]");
        if (Array.isArray(saved)) this.seen = new Set(saved.filter((id): id is string => typeof id === "string"));
      } catch { this.seen = new Set(); }
      this.remember(this.library.projects.map(project => project.documentId));
    } catch { this.onState?.("browser"); }
  }

  private async cached(id: DocumentId): Promise<StorageSnapshot | null> {
    const snapshot = await super.loadSnapshot(id);
    if (!snapshot) return null;
    const deltas = await super.loadDeltas(id, snapshot.clock);
    const scene = createSceneDoc();
    try {
      Y.applyUpdate(scene, snapshot.documentBlob);
      for (const delta of deltas) Y.applyUpdate(scene, delta.updateBlob);
      const doc = yDocToDocument(scene);
      return { meta: { documentId: id, name: doc.name, createdAt: doc.meta.createdAt, updatedAt: Math.max(snapshot.meta.updatedAt, ...deltas.map(delta => delta.timestamp)), nodeCount: Object.keys(doc.nodes).length, schemaVersion: doc.schemaVersion }, clock: deltas.at(-1)?.sequenceNumber ?? snapshot.clock, documentBlob: Y.encodeStateAsUpdate(scene), stateVector: Y.encodeStateVector(scene) };
    } finally { scene.destroy(); }
  }

  override async loadSnapshot(id: DocumentId): Promise<StorageSnapshot | null> {
    if (deletedBoardIds().has(id) || this.library?.deletedIds.includes(id)) return null;
    const local = await this.cached(id);
    if (!this.library) return local;
    try {
      const response = await request(`/${encodeURIComponent(id)}`);
      if (response.status === 404) return local;
      if (!response.ok) throw new Error("Could not open project file");
      const imported = deserializeTalwegFile(await response.text());
      try {
        if (imported.doc.id !== id || yDocToDocument(imported.ydoc).id !== id) throw new Error("Project id mismatch");
        this.diskVersions.set(id, uint8ArrayToBase64(Y.encodeStateAsUpdate(imported.ydoc)));
        promoteTemplateDraft(id);
        if (local) Y.applyUpdate(imported.ydoc, local.documentBlob);
        for (const asset of Object.values(imported.assets)) await super.saveAsset({ assetId: asset.id, mimeType: asset.mimeType, data: asset.data, size: asset.data.byteLength, lastRetrieved: Date.now() });
        const doc = yDocToDocument(imported.ydoc);
        const snapshot: StorageSnapshot = { meta: { documentId: id, name: doc.name, schemaVersion: doc.schemaVersion, createdAt: doc.meta.createdAt, updatedAt: Math.max(doc.meta.updatedAt, imported.doc.meta.updatedAt, local?.meta.updatedAt ?? 0), nodeCount: Object.keys(doc.nodes).length }, clock: local?.clock ?? 0, documentBlob: Y.encodeStateAsUpdate(imported.ydoc), stateVector: Y.encodeStateVector(imported.ydoc) };
        await super.saveSnapshot(snapshot);
        if (this.diskVersions.get(id) !== uint8ArrayToBase64(snapshot.documentBlob)) this.queue(id);
        else this.onState?.("library");
        return snapshot;
      } finally { imported.ydoc.destroy(); }
    } catch {
      this.onState?.("library-error");
      if (!local) throw new Error("Project file is unavailable; its browser cache is empty");
      return local;
    }
  }

  override async listSnapshots(): Promise<StorageSnapshot[]> {
    if (this.library) {
      for (const project of this.library.projects) {
        try { await this.loadSnapshot(project.documentId); }
        catch { this.library.issues.push(project.filename); }
      }
      const drafts = templateDraftIds();
      for (const local of await super.listSnapshots()) {
        if (!drafts.has(local.meta.documentId) && !this.seen.has(local.meta.documentId) && !this.library.deletedIds.includes(local.meta.documentId)) this.queue(local.meta.documentId);
      }
      await this.flush();
    }
    const deleted = new Set([...deletedBoardIds(), ...(this.library?.deletedIds ?? [])]);
    const snapshots = (await super.listSnapshots()).filter(snapshot => !deleted.has(snapshot.meta.documentId));
    if (!this.library) return snapshots;
    const files = new Set(this.library.projects.map(project => project.documentId));
    return snapshots.filter(snapshot => files.has(snapshot.meta.documentId) || !this.seen.has(snapshot.meta.documentId));
  }

  async deleteProject(id: DocumentId): Promise<void> {
    this.pending.delete(id);
    await this.localWrites;
    await this.writing;
    if (this.library) {
      const response = await request(`/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete project file");
      this.remember([id]);
      this.library.deletedIds.push(id);
      this.library.projects = this.library.projects.filter(project => project.documentId !== id);
    }
    markBoardDeleted(id);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const opening = indexedDB.open(STORAGE_DB_NAME);
      opening.onsuccess = () => { resolve(opening.result); };
      opening.onerror = () => { reject(opening.error ?? new Error("Could not open browser storage")); };
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(["snapshots", "deltas"], "readwrite");
        transaction.objectStore("snapshots").delete(id);
        transaction.objectStore("deltas").delete(IDBKeyRange.bound([id, 0], [id, Number.POSITIVE_INFINITY]));
        transaction.oncomplete = () => { resolve(); };
        transaction.onerror = () => { reject(transaction.error ?? new Error("Could not remove browser copy")); };
        transaction.onabort = () => { reject(transaction.error ?? new Error("Removing browser copy was interrupted")); };
      });
    } finally { database.close(); }
  }

  override saveSnapshot(snapshot: StorageSnapshot): Promise<void> {
    if (this.library && !templateDraftIds().has(snapshot.meta.documentId)) this.onState?.("library-saving");
    const operation = super.saveSnapshot(snapshot).then(() => {
      if (!templateDraftIds().has(snapshot.meta.documentId)) this.queue(snapshot.meta.documentId);
    });
    this.localWrites = Promise.allSettled([this.localWrites, operation]).then(() => undefined);
    return operation;
  }

  override saveDeltas(deltas: readonly StorageDelta[]): Promise<void> {
    if (this.library && deltas.some(delta => !templateDraftIds().has(delta.documentId))) this.onState?.("library-saving");
    const operation = super.saveDeltas(deltas).then(() => {
      for (const delta of deltas) if (!templateDraftIds().has(delta.documentId)) this.queue(delta.documentId);
    });
    this.localWrites = Promise.allSettled([this.localWrites, operation]).then(() => undefined);
    return operation;
  }

  private queue(id: DocumentId): void {
    if (deletedBoardIds().has(id) || this.library?.deletedIds.includes(id)) return;
    if (!this.library) return;
    this.pending.add(id);
    if (this.closing) return;
    this.onState?.("library-saving");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = undefined; void this.flush(); }, 500);
  }

  private async upload(id: DocumentId): Promise<void> {
    const snapshot = await this.cached(id);
    if (!snapshot || this.diskVersions.get(id) === uint8ArrayToBase64(snapshot.documentBlob)) return;
    const scene = createSceneDoc();
    try {
      Y.applyUpdate(scene, snapshot.documentBlob);
      const doc = yDocToDocument(scene);
      const assets: Record<string, { mimeType: string; data: ArrayBuffer }> = {};
      const ids = new Set(Object.values(doc.nodes).flatMap(node => [...(node.type === "image" ? [node.data.assetId] : []), ...Array.from((node.note ?? "").matchAll(/asset:([a-f\d]{64})/g), match => match[1] ?? "")]));
      for (const assetId of ids) {
        const asset = await super.getAsset(assetId);
        if (!asset) throw new Error(`Missing project image: ${assetId}`);
        assets[assetId] = { mimeType: asset.mimeType, data: asset.data };
      }
      const response = await request(`/${encodeURIComponent(id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: serializeTalwegFile(doc, scene, assets), keepalive: false });
      if (!response.ok) throw new Error("Could not save project file");
      const saved = deserializeTalwegFile(await response.text());
      try {
        this.diskVersions.set(id, uint8ArrayToBase64(Y.encodeStateAsUpdate(saved.ydoc)));
        this.remember([id]);
        if (this.library) {
          const existing = this.library.projects.find(project => project.documentId === id);
          this.library.projects = this.library.projects.filter(project => project.documentId !== id);
          this.library.projects.push({ ...snapshot.meta, name: saved.doc.name, updatedAt: saved.doc.meta.updatedAt, nodeCount: Object.keys(saved.doc.nodes).length, filename: existing?.filename ?? `${id}.talweg` });
        }
      }
      finally { saved.ydoc.destroy(); }
    } finally { scene.destroy(); }
  }

  flush(): Promise<void> {
    clearTimeout(this.timer); this.timer = undefined;
    this.writing = this.writing.then(async () => {
      for (const id of this.pending) {
        this.pending.delete(id);
        try { await this.upload(id); }
        catch {
          this.pending.add(id);
          this.onState?.("library-error");
          if (!this.closing && !this.timer) this.timer = setTimeout(() => { this.timer = undefined; void this.flush(); }, 3000);
          return;
        }
      }
      if (this.library) this.onState?.("library");
    });
    return this.writing;
  }

  override async close(): Promise<void> {
    this.closing = true;
    await this.localWrites.catch(() => undefined);
    await this.flush();
    clearTimeout(this.timer);
    await super.close();
    openAdapters.delete(this);
  }
}
