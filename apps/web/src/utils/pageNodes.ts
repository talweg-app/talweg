import type { CanvasDocument, CanvasNode, NodeId, PageId } from "@talweg/core";

export function firstPageId(document: CanvasDocument): PageId {
  return Object.values(document.pages ?? {}).sort((a, b) => a.order - b.order)[0]?.id ?? "page-1";
}

export function pageNodes(document: CanvasDocument, pageId: PageId = document.activePageId ?? firstPageId(document)): Record<NodeId, CanvasNode> {
  const fallback = firstPageId(document);
  return Object.fromEntries(Object.entries(document.nodes).filter(([, node]) => (node.pageId ?? fallback) === pageId));
}
