import type { CanvasNode, TransformBox2D } from "@talweg/core";

export function resizeNodeContent(node: CanvasNode, box: TransformBox2D): CanvasNode {
  if (node.type === "image" || node.type === "arrow" || node.type === "group") return node;
  const scale = Math.sqrt((box.width / Math.max(1, node.width)) * (box.height / Math.max(1, node.height)));
  const fontSize = (size: number) => Math.max(6, Math.min(240, Math.round(size * scale * 10) / 10));
  const content = {
    style: { ...node.style, fontSize: fontSize(node.style.fontSize ?? 14) },
    ...(node.textRuns ? { textRuns: Object.fromEntries(Object.entries(node.textRuns).map(([field, runs]) => [field, runs.map((run) => run.fontSize ? { ...run, fontSize: fontSize(run.fontSize) } : run)])) } : {}),
  };
  if (node.type === "table" && node.data.cellStyles) return { ...node, ...content, data: { ...node.data, cellStyles: Object.fromEntries(Object.entries(node.data.cellStyles).map(([key, style]) => [key, style.fontSize ? { ...style, fontSize: fontSize(style.fontSize) } : style])) } };
  return { ...node, ...content };
}
