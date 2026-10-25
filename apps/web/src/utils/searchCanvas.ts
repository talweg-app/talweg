import type { CanvasDocument, CanvasNode } from "@talweg/core";
import { firstPageId } from "./pageNodes.js";

export function nodeSearchText(node: CanvasNode): string {
  const data = node.data;
  const fields: string[] = [node.note ?? ""];
  if (typeof node.meta?.title === "string") fields.push(node.meta.title);
  if (data) {
    for (const key of [
      "label",
      "title",
      "description",
      "content",
      "text",
      "altText",
    ] as const) {
      if (key in data && typeof data[key as keyof typeof data] === "string")
        fields.push(String(data[key as keyof typeof data]));
    }
  }
  if (node.type === "table") fields.push(...node.data.cells.flat());
  if (node.type === "checklist")
    fields.push(...node.data.items.map((item) => item.text));
  return fields.join(" ").replace(/\s+/g, " ").trim();
}

export function searchCanvas(document: CanvasDocument, query: string) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return Object.values(document.nodes)
    .filter((node) => node.isVisible)
    .flatMap((node) => {
      const text = nodeSearchText(node);
      const normalized = text.toLocaleLowerCase();
      if (!words.every((word) => normalized.includes(word))) return [];
      const index = normalized.indexOf(words[0] ?? "");
      const from = Math.max(0, index - 35);
      const excerpt = `${from ? "…" : ""}${text.slice(from, from + 150)}${text.length > from + 150 ? "…" : ""}`;
      const pageId = node.pageId ?? firstPageId(document);
      return [{ node, excerpt, pageId }];
    });
}
