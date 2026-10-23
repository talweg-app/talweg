import type { StorageAdapter } from "@talweg/storage";

const assetUrlCache = new Map<string, string>();

export function getCachedAssetUrl(assetId: string): string | undefined {
  return assetUrlCache.get(assetId);
}

export function setCachedAssetUrl(assetId: string, url: string): void {
  assetUrlCache.set(assetId, url);
}

export async function resolveAssetUrl(
  assetId: string,
  adapter?: StorageAdapter | null,
): Promise<string | null> {
  const cached = assetUrlCache.get(assetId);
  if (cached !== undefined) {
    return cached;
  }

  if (!adapter) {
    return null;
  }

  try {
    const record = await adapter.getAsset(assetId);
    if (!record) {
      return null;
    }

    const blob = new Blob([record.data], { type: record.mimeType });
    const objectUrl = URL.createObjectURL(blob);
    assetUrlCache.set(assetId, objectUrl);
    return objectUrl;
  } catch {
    return null;
  }
}

export function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}
