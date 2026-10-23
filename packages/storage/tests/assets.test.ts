import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  IndexedDBStorageAdapter,
  STORAGE_DB_NAME,
  computeSha256,
} from "../src/index.js";
import type { StorageAsset } from "../src/index.js";

let adapters: IndexedDBStorageAdapter[] = [];

async function deleteStorageDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(STORAGE_DB_NAME);

    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      reject(new Error("Failed to delete storage database", { cause: request.error }));
    };
    request.onblocked = () => {
      reject(new Error("Storage database deletion blocked"));
    };
  });
}

async function createAdapter(): Promise<IndexedDBStorageAdapter> {
  const adapter = new IndexedDBStorageAdapter();
  adapters.push(adapter);
  await adapter.initialize();
  return adapter;
}

beforeEach(async () => {
  await deleteStorageDatabase();
});

afterEach(async () => {
  await Promise.all(adapters.map((adapter) => adapter.close()));
  adapters = [];
});

describe("computeSha256", () => {
  it("computes standard SHA-256 for Uint8Array", async () => {
    const data = new Uint8Array([1, 2, 3]);
    const hash = await computeSha256(data);
    expect(hash).toBe("039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81");
  });

  it("computes standard SHA-256 for ArrayBuffer", async () => {
    const data = new Uint8Array([1, 2, 3]).buffer;
    const hash = await computeSha256(data);
    expect(hash).toBe("039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81");
  });
});

describe("IndexedDBStorageAdapter asset store", () => {
  it("saves a Blob, computes SHA-256, and retrieves asset by hash", async () => {
    const adapter = await createAdapter();
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const blob = new Blob([bytes], { type: "image/png" });

    const hash = await adapter.saveAsset(blob);
    expect(typeof hash).toBe("string");
    expect(hash.length).toBe(64);

    const retrieved = await adapter.getAsset(hash);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(hash);
    expect(retrieved!.assetId).toBe(hash);
    expect(retrieved!.mimeType).toBe("image/png");
    expect(new Uint8Array(retrieved!.data)).toEqual(bytes);
    expect(retrieved!.createdAt).toBeGreaterThan(0);
  });

  it("falls back to application/octet-stream when Blob has no mime type", async () => {
    const adapter = await createAdapter();
    const bytes = new Uint8Array([10, 20, 30]);
    const blob = new Blob([bytes]);

    const hash = await adapter.saveAsset(blob);
    const retrieved = await adapter.getAsset(hash);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.mimeType).toBe("application/octet-stream");
  });

  it("saves ArrayBuffer with and without custom mime type", async () => {
    const adapter = await createAdapter();
    const bytes = new Uint8Array([42, 43, 44]).buffer;

    const hash1 = await adapter.saveAsset(bytes, "image/jpeg");
    const retrieved1 = await adapter.getAsset(hash1);
    expect(retrieved1).not.toBeNull();
    expect(retrieved1!.mimeType).toBe("image/jpeg");

    const hash2 = await adapter.saveAsset(bytes);
    const retrieved2 = await adapter.getAsset(hash2);
    expect(retrieved2).not.toBeNull();
    expect(retrieved2!.mimeType).toBe("application/octet-stream");
    expect(hash1).toBe(hash2);
  });

  it("saves Uint8Array with and without custom mime type", async () => {
    const adapter = await createAdapter();
    const view = new Uint8Array([9, 8, 7]);

    const hash1 = await adapter.saveAsset(view, "image/webp");
    const retrieved1 = await adapter.getAsset(hash1);
    expect(retrieved1).not.toBeNull();
    expect(retrieved1!.mimeType).toBe("image/webp");

    const hash2 = await adapter.saveAsset(view);
    const retrieved2 = await adapter.getAsset(hash2);
    expect(retrieved2).not.toBeNull();
    expect(retrieved2!.mimeType).toBe("application/octet-stream");
    expect(hash1).toBe(hash2);
  });

  it("saves StorageAsset object and preserves explicitId and timestamps", async () => {
    const adapter = await createAdapter();
    const asset: StorageAsset = {
      assetId: "custom-token-id",
      mimeType: "text/plain",
      data: new Uint8Array([100, 101]).buffer,
      size: 2,
      lastRetrieved: 5000,
    };

    const returnedId = await adapter.saveAsset(asset);
    expect(returnedId).toBe("custom-token-id");

    const retrieved = await adapter.getAsset("custom-token-id");
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe("custom-token-id");
    expect(retrieved!.lastRetrieved).toBe(5000);
  });

  it("handles Blob with custom mimeType and object input without mimeType", async () => {
    const adapter = await createAdapter();
    const bytes = new Uint8Array([11, 22, 33]);
    const blobWithoutType = new Blob([bytes]);

    const hash1 = await adapter.saveAsset(blobWithoutType, "image/gif");
    const retrieved1 = await adapter.getAsset(hash1);
    expect(retrieved1!.mimeType).toBe("image/gif");

    const buf = bytes.buffer;
    const hash2 = await adapter.saveAsset({ data: buf } as unknown as StorageAsset, "text/csv");
    const retrieved2 = await adapter.getAsset(hash2);
    expect(retrieved2!.mimeType).toBe("text/csv");

    const hash3 = await adapter.saveAsset({ data: buf, createdAt: 9999 } as unknown as StorageAsset);
    const retrieved3 = await adapter.getAsset(hash3);
    expect(retrieved3!.mimeType).toBe("application/octet-stream");
    expect(retrieved3!.createdAt).toBe(9999);

    const blobWithType = new Blob([bytes], { type: "image/png" });
    const hashOverridden = await adapter.saveAsset(blobWithType, "image/webp");
    const retrievedOverridden = await adapter.getAsset(hashOverridden);
    expect(retrievedOverridden!.mimeType).toBe("image/webp");

    const hashEmptyMime = await adapter.saveAsset({ data: buf, mimeType: "" } as unknown as StorageAsset);
    const retrievedEmptyMime = await adapter.getAsset(hashEmptyMime);
    expect(retrievedEmptyMime!.mimeType).toBe("application/octet-stream");
  });

  it("returns null when querying an unknown asset hash", async () => {
    const adapter = await createAdapter();
    const result = await adapter.getAsset("non-existent-sha256-hash");
    expect(result).toBeNull();
  });

  it("throws when calling saveAsset or getAsset on uninitialized adapter", async () => {
    const adapter = new IndexedDBStorageAdapter();

    await expect(adapter.saveAsset(new Uint8Array([1]))).rejects.toThrow("not initialized");
    await expect(adapter.getAsset("some-hash")).rejects.toThrow("not initialized");
  });

  it("throws when passing invalid input to saveAsset", async () => {
    const adapter = await createAdapter();

    await expect(adapter.saveAsset(null as unknown as Blob)).rejects.toThrow("Invalid asset input");
    await expect(adapter.saveAsset(12345 as unknown as Blob)).rejects.toThrow("Invalid asset input");
  });
});
