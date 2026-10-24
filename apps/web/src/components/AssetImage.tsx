import { useEffect, useState } from "react";
import type { StorageAdapter } from "@talweg/storage";
import { getCachedAssetUrl, resolveAssetUrl } from "../utils/assets.js";

export function AssetImage({
  assetId,
  alt,
  adapter,
}: {
  assetId: string;
  alt: string;
  adapter?: StorageAdapter | null | undefined;
}) {
  const [url, setUrl] = useState<string | null>(
    () => getCachedAssetUrl(assetId) ?? null,
  );
  useEffect(() => {
    let active = true;
    void resolveAssetUrl(assetId, adapter).then((resolved) => {
      if (active) setUrl(resolved);
    });
    return () => {
      active = false;
    };
  }, [assetId, adapter]);
  return url ? (
    <img src={url} alt={alt} draggable={false} />
  ) : (
    <span className="asset-placeholder">{alt || "…"}</span>
  );
}
