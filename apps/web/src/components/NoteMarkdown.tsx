import { memo, useMemo } from "react";
import Markdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { StorageAdapter } from "@talweg/storage";
import { navigate } from "../routes/router.js";
import { useTranslation } from "../hooks/useTranslation.js";
import { useNodeLinks, sessionNodeHref } from "./NodeLinks.js";
import { AssetImage } from "./AssetImage.js";

export default memo(function NoteMarkdown({ source, adapter }: { source: string; adapter?: StorageAdapter | null | undefined }) {
  const { t } = useTranslation();
  const document = useNodeLinks();
  const components = useMemo<Components>(() => ({
    img: ({ src, alt }) => typeof src === "string" && src.startsWith("asset:") ? <AssetImage assetId={src.slice(6)} alt={alt ?? ""} adapter={adapter} /> : typeof src === "string" && /^data:image\/(png|jpeg|webp|gif);base64,/i.test(src) ? <img src={src} alt={alt ?? ""} draggable={false} /> : <span className="asset-placeholder">{t("note.localImageOnly")}</span>,
    a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" onPointerDown={event => { if (event.button === 0) event.stopPropagation(); }} onClick={event => { if (href?.startsWith("/board/")) { event.preventDefault(); navigate(sessionNodeHref(href, document)); } }}>{children}</a>,
  }), [adapter, document, t]);
  return <Markdown skipHtml remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { trust: false, maxSize: 20, maxExpand: 1000 }]]}
    urlTransform={url => url.startsWith("asset:") || /^data:image\/(png|jpeg|webp|gif);base64,/i.test(url) ? url : defaultUrlTransform(url)}
    components={components}>
    {source || t("note.empty")}
  </Markdown>;
});
