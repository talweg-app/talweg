import type { CanvasDocument, DocumentId } from "@talweg/core";

export function copyBoard(
  source: CanvasDocument,
  id: DocumentId,
  room?: string,
): CanvasDocument {
  const copy = { ...structuredClone(source), id };
  copy.name = `${source.name} (copy)`;
  copy.meta.createdAt = Date.now();
  copy.meta.updatedAt = copy.meta.createdAt;
  const rewrite = (href: string): string => {
    if (!href.startsWith("/board/")) return href;
    const url = new URL(href, "https://talweg.invalid");
    const board = decodeURIComponent(url.pathname.split("/")[2] ?? "");
    if (board !== source.id && board !== `room-${room ?? ""}`) return href;
    url.pathname = url.pathname.replace(
      /^\/board\/[^/]+/,
      `/board/${encodeURIComponent(id)}`,
    );
    url.searchParams.delete("room");
    return url.pathname + url.search + url.hash;
  };
  for (const node of Object.values(copy.nodes)) {
    if (node.textRuns)
      for (const runs of Object.values(node.textRuns))
        for (const run of runs) if (run.href) run.href = rewrite(run.href);
    if (node.note)
      node.note = node.note.replace(
        /\]\((\/board\/[^\s)]+)\)/g,
        (_match: string, href: string) => `](${rewrite(href)})`,
      );
  }
  return copy;
}
