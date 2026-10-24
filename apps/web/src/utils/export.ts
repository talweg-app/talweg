import {
  type ArrowNode,
  type BoundingBox,
  type CanvasDocument,
  type CanvasNode,
  computeGroupBounds,
} from "@talweg/core";
import { renderOrthogonalEdge } from "@talweg/router";
import { drawNode } from "./drawNode.js";

function nodeToBoundingBox(node: CanvasNode): BoundingBox {
  return {
    minX: node.x,
    minY: node.y,
    maxX: node.x + node.width,
    maxY: node.y + node.height,
    width: node.width,
    height: node.height,
  };
}

export function exportToPng(document: CanvasDocument, filename = "talweg-canvas.png"): void {
  const visibleNodes = Object.values(document.nodes).filter((node) => node.isVisible && (!document.activePageId || !node.pageId || node.pageId === document.activePageId));
  const nodes = visibleNodes.filter((node) => node.type !== "arrow");
  if (nodes.length === 0) return;

  const bounds = computeGroupBounds(nodes);
  const padding = 60;
  const canvasWidth = bounds.width + padding * 2;
  const canvasHeight = bounds.height + padding * 2;
  const pixelRatio = 2;

  const canvas = window.document.createElement("canvas");
  canvas.width = canvasWidth * pixelRatio;
  canvas.height = canvasHeight * pixelRatio;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.scale(pixelRatio, pixelRatio);

  // Background
  ctx.fillStyle = "#101112";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const originX = bounds.minX - padding;
  const originY = bounds.minY - padding;

  // Grid dots
  ctx.fillStyle = "#202223";
  const gridSize = 24;
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
  const obstacles = nodes.map(nodeToBoundingBox);
  const edgeLabels: { text: string; x: number; y: number }[] = [];

  for (const arrow of arrowNodes) {
    const sourceNode = document.nodes[arrow.data.sourceId];
    const targetNode = document.nodes[arrow.data.targetId];
    if (!sourceNode || !targetNode) continue;

    const sourceBox = nodeToBoundingBox(sourceNode);
    const targetBox = nodeToBoundingBox(targetNode);

    const edgeObstacles = obstacles.filter(
      (b) =>
        !(b.minX === sourceBox.minX && b.minY === sourceBox.minY) &&
        !(b.minX === targetBox.minX && b.minY === targetBox.minY),
    );

    const rendered = renderOrthogonalEdge(
      sourceBox,
      targetBox,
      undefined,
      undefined,
      edgeObstacles,
      {
        cornerRadius: 8,
        endArrow: arrow.data.endArrow ?? "arrow",
        strokeWidth: arrow.style.strokeWidth ?? 1.5,
      },
    );

    ctx.save();
    ctx.translate(-originX, -originY);

    const path = new Path2D(rendered.lineSvgPath);
    ctx.strokeStyle = arrow.style.strokeColor ?? "#38bdf8";
    ctx.lineWidth = arrow.style.strokeWidth ?? 1.5;
    ctx.setLineDash(arrow.style.strokeDash === "dashed" ? [8, 5] : arrow.style.strokeDash === "dotted" ? [2, 4] : []);
    if (arrow.style.strokeWidth !== 0 && arrow.style.strokeDash !== "none") ctx.stroke(path);

    if (rendered.endMarkerSvg && arrow.style.strokeWidth !== 0 && arrow.style.strokeDash !== "none") {
      const markerPath = new Path2D(rendered.endMarkerSvg);
      ctx.fillStyle = arrow.style.strokeColor ?? "#38bdf8";
      ctx.fill(markerPath);
    }

    // labels are collected and drawn after nodes, otherwise node boxes cover them
    if (arrow.data.label) {
      const mid =
        rendered.waypoints[Math.floor(rendered.waypoints.length / 2)] ??
        { x: (sourceBox.minX + targetBox.maxX) / 2, y: (sourceBox.minY + targetBox.maxY) / 2 };
      edgeLabels.push({ text: arrow.data.label, x: mid.x, y: mid.y });
    }

    ctx.restore();
  }

  for (const node of [...nodes].sort((a, b) => a.zIndex - b.zIndex)) {
    ctx.save();
    ctx.translate(node.x - originX + node.width / 2, node.y - originY + node.height / 2);
    ctx.rotate(node.rotation * Math.PI / 180);
    ctx.translate(-node.width / 2, -node.height / 2);
    drawNode(ctx, node);
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
    ctx.fillStyle = "#090a0f";
    ctx.strokeStyle = "#27272a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(item.x - textWidth / 2 - 6, item.y - 9, textWidth + 12, 18, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#a1a1aa";
    ctx.fillText(item.text, item.x, item.y);
  }
  ctx.restore();

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
