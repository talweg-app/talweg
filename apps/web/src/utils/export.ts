import { worldDocument, groupBounds } from "./organizeCanvas.js";
import { nodeAppearance, connectorAppearance } from "./sceneAppearance.js";
import { canvasBackground, type Theme } from "../themeContext.js";
import {
  type ArrowNode,
  type CanvasDocument,
  computeGroupBounds,
} from "@talweg/core";
import type { StorageAdapter } from "@talweg/storage";
import { resolveAssetUrl } from "./assets.js";
import {
  buildPortSlotMap,
  computeConnectorGeometry,
} from "./connectorGeometry.js";
import { firstPageId, pageNodes } from "./pageNodes.js";
import { drawNode } from "./drawNode.js";

export async function renderCanvasImage(
  document: CanvasDocument,
  adapter?: StorageAdapter | null,
  theme: Theme = "dark",
  options: { maxDimension?: number; assetUrls?: ReadonlyMap<string, string> } = {},
): Promise<HTMLCanvasElement | null> {
  document = worldDocument(document);
  const visibleNodes = Object.values(
    pageNodes(document, document.activePageId ?? firstPageId(document)),
  ).filter((node) => node.isVisible);
  const nodes = visibleNodes
    .filter((node) => node.type !== "arrow")
    .map((node) =>
      node.type === "group"
        ? { ...node, ...groupBounds(document, node) }
        : node,
    );
  if (nodes.length === 0) return null;
  await window.document.fonts.ready;

  const images = new Map<string, HTMLImageElement>();
  await Promise.all(
    nodes
      .filter((node) => node.type === "image")
      .map(async (node) => {
        const url = options.assetUrls ? options.assetUrls.get(node.data.assetId) : await resolveAssetUrl(node.data.assetId, adapter);
        if (!url) throw new Error(`Missing image asset: ${node.data.assetId}`);
        const image = new Image();
        image.src = url;
        await image.decode();
        images.set(node.id, image);
      }),
  );
  const bounds = computeGroupBounds(nodes);
  const padding = 60;
  const canvasWidth = bounds.width + padding * 2;
  const canvasHeight = bounds.height + padding * 2;
  const pixelRatio = options.maxDimension ? Math.min(2, options.maxDimension / Math.max(canvasWidth, canvasHeight)) : 2;

  const canvas = window.document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(canvasWidth * pixelRatio));
  canvas.height = Math.max(1, Math.ceil(canvasHeight * pixelRatio));

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.scale(pixelRatio, pixelRatio);

  // Background
  ctx.fillStyle = canvasBackground[theme];
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const originX = bounds.minX - padding;
  const originY = bounds.minY - padding;

  // Grid dots
  ctx.fillStyle = theme === "light" ? "#dfe1db" : "#202223";
  const gridSize = options.maxDimension ? Math.max(24, 24 / pixelRatio) : 24;
  const startX = Math.floor(originX / gridSize) * gridSize;
  const startY = Math.floor(originY / gridSize) * gridSize;
  for (let x = startX; x < originX + canvasWidth; x += gridSize) {
    for (let y = startY; y < originY + canvasHeight; y += gridSize) {
      const screenX = x - originX;
      const screenY = y - originY;
      ctx.beginPath();
      ctx.arc(screenX, screenY, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw connectors
  const arrowNodes = visibleNodes.filter(
    (node): node is ArrowNode => node.type === "arrow",
  );
  const scene = {
    ...document,
    nodes: Object.fromEntries(visibleNodes.map((node) => [node.id, node])),
  };
  const portSlots = buildPortSlotMap(scene);
  const edgeLabels: { text: string; x: number; y: number }[] = [];

  for (const arrow of arrowNodes) {
    const rendered = computeConnectorGeometry(arrow, scene, portSlots);
    if (!rendered) continue;

    ctx.save();
    ctx.translate(-originX, -originY);

    const path = new Path2D(rendered.lineSvgPath);
    ctx.strokeStyle = connectorAppearance(
      arrow.style.strokeColor ?? "#38bdf8",
      theme,
    );
    ctx.lineWidth = arrow.style.strokeWidth ?? 1.5;
    ctx.setLineDash(
      arrow.style.strokeDash === "dashed"
        ? [8, 5]
        : arrow.style.strokeDash === "dotted"
          ? [2, 4]
          : [],
    );
    if (arrow.style.strokeWidth !== 0 && arrow.style.strokeDash !== "none")
      ctx.stroke(path);

    if (
      rendered.endMarkerSvg &&
      arrow.style.strokeWidth !== 0 &&
      arrow.style.strokeDash !== "none"
    ) {
      const markerPath = new Path2D(rendered.endMarkerSvg);
      ctx.fillStyle = connectorAppearance(
        arrow.style.strokeColor ?? "#38bdf8",
        theme,
      );
      ctx.fill(markerPath);
    }

    // labels are collected and drawn after nodes, otherwise node boxes cover them
    if (arrow.data.label) {
      const mid = rendered.midpoint;
      edgeLabels.push({ text: arrow.data.label, x: mid.x, y: mid.y });
    }

    ctx.restore();
  }

  for (const node of [...nodes].sort((a, b) =>
    a.type === "group" && b.type !== "group"
      ? -1
      : b.type === "group" && a.type !== "group"
        ? 1
        : a.zIndex - b.zIndex,
  )) {
    ctx.save();
    ctx.translate(
      node.x - originX + node.width / 2,
      node.y - originY + node.height / 2,
    );
    ctx.rotate((node.rotation * Math.PI) / 180);
    ctx.translate(-node.width / 2, -node.height / 2);
    drawNode(
      ctx,
      { ...node, style: nodeAppearance(node.style, theme) },
      images.get(node.id),
      canvasBackground[theme],
      theme,
    );
    ctx.restore();
  }

  // edge labels on top of nodes, mirroring the on-screen overlay ordering
  ctx.save();
  ctx.translate(-originX, -originY);
  ctx.font = "500 10px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const item of edgeLabels) {
    const textWidth = ctx.measureText(item.text).width;
    ctx.fillStyle = theme === "light" ? "#ffffff" : "#090a0f";
    ctx.strokeStyle = theme === "light" ? "#dedfd9" : "#27272a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(
      item.x - textWidth / 2 - 6,
      item.y - 9,
      textWidth + 12,
      18,
      3,
    );
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = theme === "light" ? "#656861" : "#a1a1aa";
    ctx.fillText(item.text, item.x, item.y);
  }
  ctx.restore();

  return canvas;
}

export async function exportToPng(
  document: CanvasDocument,
  filename = "talweg-canvas.png",
  adapter?: StorageAdapter | null,
  theme: Theme = "dark",
): Promise<void> {
  const canvas = await renderCanvasImage(document, adapter, theme);
  if (!canvas) return;
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}
