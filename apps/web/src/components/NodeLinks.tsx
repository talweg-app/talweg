import { worldDocument } from "../utils/organizeCanvas.js";
import { createContext, useContext } from "react";
import type { CanvasDocument, CanvasNode } from "@talweg/core";

export const NodeLinksContext = createContext<CanvasDocument | null>(null);

export function useNodeLinks() {
  return useContext(NodeLinksContext);
}

export function nodeCaption(node: CanvasNode): string {
  const content = node.data;
  if (
    content &&
    "label" in content &&
    typeof content.label === "string" &&
    content.label
  )
    return content.label;
  if (
    content &&
    "title" in content &&
    typeof content.title === "string" &&
    content.title
  )
    return content.title;
  if (node.type === "text") return node.data.text;
  return node.type;
}

export function nodeHref(document: CanvasDocument, node: CanvasNode): string {
  node = worldDocument(document).nodes[node.id] ?? node;
  const width = window.innerWidth;
  const height = window.innerHeight - 56;
  const zoom = Math.min(
    1,
    width / (node.width + 160),
    height / (node.height + 160),
  );
  const x = width / (2 * zoom) - node.x - node.width / 2;
  const y = height / (2 * zoom) - node.y - node.height / 2;
  const page = node.pageId ?? Object.keys(document.pages ?? {})[0] ?? "page-1";
  return `/board/${encodeURIComponent(document.id)}/page/${encodeURIComponent(page)}?node=${encodeURIComponent(node.id)}#cam=${x.toFixed(1)},${y.toFixed(1)},${zoom.toFixed(3)}`;
}

export function sessionNodeHref(
  href: string,
  document: CanvasDocument | null,
): string {
  const room = new URLSearchParams(window.location.search).get("room");
  if (!room || !document || !href.startsWith("/board/")) return href;
  const url = new URL(href, window.location.origin);
  const board = decodeURIComponent(url.pathname.split("/")[2] ?? "");
  if (board !== document.id && board !== `room-${room}`) return href;
  url.pathname = url.pathname.replace(/^\/board\/[^/]+/, `/board/room-${room}`);
  url.searchParams.set("room", room);
  return url.pathname + url.search + url.hash;
}
