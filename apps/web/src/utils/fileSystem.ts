import type { CanvasDocument } from "@talweg/core";
import {
  type IndexedDBStorageAdapter,
  type StorageAdapter,
  deserializeTalwegFile,
  serializeTalwegFile,
} from "@talweg/storage";
import * as Y from "yjs";
import { setCachedAssetUrl } from "./assets.js";

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
}

interface OpenFilePickerOptions {
  mode?: "read" | "readwrite";
  types?: FilePickerAcceptType[];
  multiple?: boolean;
}

interface NativeFileSystemWritableFileStream {
  write(data: unknown): Promise<void>;
  close(): Promise<void>;
}

export interface NativeFileSystemFileHandle {
  readonly name: string;
  createWritable(): Promise<NativeFileSystemWritableFileStream>;
  getFile(): Promise<File>;
}

declare global {
  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<NativeFileSystemFileHandle>;
    showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<NativeFileSystemFileHandle[]>;
  }
}

// Retained file handle for native OS direct saves
let activeFileHandle: NativeFileSystemFileHandle | null = null;
let activeFileDocumentId: string | null = null;
const fileWriteQueues = new WeakMap<NativeFileSystemFileHandle, Promise<void>>();
const fileRequests = new WeakMap<NativeFileSystemFileHandle, number>();
const fileWritten = new WeakMap<NativeFileSystemFileHandle, number>();
function reserveWrite(handle: NativeFileSystemFileHandle): number {
  const next = (fileRequests.get(handle) ?? 0) + 1;
  fileRequests.set(handle, next);
  return next;
}

export type FileSaveState = "library" | "library-saving" | "library-error" | "browser" | "file" | "saving" | "error" | "browser-error" | "history-error";

export function getLinkedFileHandle(documentId: string): NativeFileSystemFileHandle | null {
  return activeFileDocumentId === documentId ? activeFileHandle : null;
}

export function getActiveFileName(): string | null {
  return activeFileHandle?.name ?? null;
}

export function setActiveFileHandle(handle: NativeFileSystemFileHandle | null): void {
  activeFileHandle = handle;
}

export function clearActiveFileHandle(): void {
  activeFileHandle = null;
  activeFileDocumentId = null;
}

function hasFileSystemAccess(): boolean {
  return typeof window !== "undefined" && typeof window.showSaveFilePicker === "function";
}

function fallbackBlobDownload(content: string, filename: string): void {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  window.document.body.appendChild(anchor);
  anchor.click();
  window.document.body.removeChild(anchor);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

function fallbackBlobUpload(): Promise<{ text: string; name: string } | null> {
  return new Promise((resolve) => {
    const input = window.document.createElement("input");
    input.type = "file";
    input.accept = ".talweg,application/json";
    input.style.display = "none";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        resolve(null);
        return;
      }
      try {
        const text = await file.text();
        resolve({ text, name: file.name });
      } catch {
        resolve(null);
      } finally {
        input.remove();
      }
    };

    input.oncancel = () => {
      resolve(null);
      input.remove();
    };

    window.document.body.appendChild(input);
    input.click();
  });
}

export async function saveDocumentToFileSystem(
  doc: CanvasDocument,
  ydoc: Y.Doc,
  options?: { promptNewFile?: boolean; adapter?: StorageAdapter | null; linkedHandle?: NativeFileSystemFileHandle; autoSave?: boolean },
): Promise<{ success: boolean; filename: string }> {
  if (options?.autoSave && !options.linkedHandle) return { success: false, filename: "" };
  const initialHandle = options?.linkedHandle ?? getLinkedFileHandle(doc.id);
  let writeTicket = initialHandle ? reserveWrite(initialHandle) : 0;
  const state = Y.encodeStateAsUpdate(ydoc);
  const assets: Record<string, { assetId: string; mimeType: string; data: ArrayBuffer }> = {};
  const ids = new Set(Object.values(doc.nodes).flatMap((node) => [
    ...(node.type === "image" ? [node.data.assetId] : []),
    ...[...(node.note ?? "").matchAll(/asset:([a-f\d]{64})/g)].map((match) => match[1] ?? ""),
  ]));
  for (const id of ids) {
    const asset = await options?.adapter?.getAsset(id);
    if (!asset) throw new Error(`Missing image asset: ${id}`);
    assets[id] = { assetId: id, mimeType: asset.mimeType, data: asset.data };
  }
  const frozen = new Y.Doc();
  let jsonContent: string;
  try {
    Y.applyUpdate(frozen, state);
    jsonContent = serializeTalwegFile(doc, frozen, assets);
  } finally { frozen.destroy(); }
  const baseName = doc.name ? doc.name.trim().replace(/[/\\?%*:|"<>]/g, "-") : "talweg-canvas";
  const defaultFilename = `${baseName}.talweg`;

  if (options?.linkedHandle || (typeof window !== "undefined" && typeof window.showSaveFilePicker === "function")) {
    try {
      let handle = initialHandle;
      if (!handle || options?.promptNewFile) {
        if (!window.showSaveFilePicker) return { success: false, filename: defaultFilename };
        handle = await window.showSaveFilePicker({
          suggestedName: defaultFilename,
          types: [
            {
              description: "Talweg Canvas Document (*.talweg)",
              accept: {
                "application/vnd.talweg+json": [".talweg"],
                "application/json": [".talweg"],
              },
            },
          ],
        });
        activeFileHandle = handle;
        activeFileDocumentId = doc.id;
        writeTicket = reserveWrite(handle);
      }

      const target = handle;
      const pending = (fileWriteQueues.get(target) ?? Promise.resolve()).catch(() => { /* a retry may follow a failed write */ }).then(async () => {
        if ((fileWritten.get(target) ?? 0) > writeTicket) return;
        const writable = await target.createWritable();
        await writable.write(jsonContent);
        await writable.close();
        fileWritten.set(target, writeTicket);
      });
      fileWriteQueues.set(target, pending);
      await pending;

      return { success: true, filename: handle.name };
    } catch (err) {
      if (options?.autoSave) throw err;
      // User cancelled picker
      if (err instanceof DOMException && err.name === "AbortError") {
        return { success: false, filename: defaultFilename };
      }
      throw err;
    }
  }

  // Fallback for browsers lacking File System Access API
  fallbackBlobDownload(jsonContent, defaultFilename);
  return { success: true, filename: defaultFilename };
}

export async function openDocumentFromFileSystem(): Promise<{
  text: string;
  name: string;
} | null> {
  clearActiveFileHandle();
  if (hasFileSystemAccess() && typeof window.showOpenFilePicker === "function") {
    try {
      const [handle] = await window.showOpenFilePicker({
        mode: "readwrite",
        types: [
          {
            description: "Talweg Canvas Document (*.talweg)",
            accept: {
              "application/vnd.talweg+json": [".talweg"],
              "application/json": [".talweg", ".json"],
            },
          },
        ],
        multiple: false,
      });

      if (!handle) return null;
      activeFileHandle = handle;
      const file = await handle.getFile();
      if (file.size > 100 * 1024 * 1024) {
        throw new Error("File exceeds maximum allowed size (100MB)");
      }
      const text = await file.text();
      return { text, name: handle.name };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return null;
      }
      // Fall through to input fallback
    }
  }

  return fallbackBlobUpload();
}

export async function importTalwegDocument(
  fileContent: string,
  adapter?: IndexedDBStorageAdapter | null,
): Promise<{ doc: CanvasDocument; ydoc: Y.Doc }> {
  if (fileContent.length > 100 * 1024 * 1024) {
    throw new Error("File content exceeds maximum allowed size (100MB)");
  }
  const deserialized = deserializeTalwegFile(fileContent);
  if (activeFileHandle) activeFileDocumentId = deserialized.doc.id;

  // Restore local binary assets into IndexedDB
  if (adapter) {
    for (const [id, asset] of Object.entries(deserialized.assets)) {
      await adapter.saveAsset(asset.data, asset.mimeType);
      const url = URL.createObjectURL(new Blob([asset.data], { type: asset.mimeType }));
      setCachedAssetUrl(id, url);
    }

    // Persist snapshot in IndexedDB
    await adapter.saveSnapshot({
      meta: {
        documentId: deserialized.doc.id,
        name: deserialized.doc.name,
        schemaVersion: deserialized.doc.schemaVersion,
        createdAt: deserialized.doc.meta.createdAt,
        updatedAt: Date.now(),
        nodeCount: Object.keys(deserialized.doc.nodes).length,
      },
      clock: 0,
      stateVector: Y.encodeStateVector(deserialized.ydoc),
      documentBlob: Y.encodeStateAsUpdate(deserialized.ydoc),
    });
  }

  return { doc: deserialized.doc, ydoc: deserialized.ydoc };
}
