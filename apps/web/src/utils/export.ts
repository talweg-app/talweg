import {
  type ArrowNode,
  type BoundingBox,
  type CanvasDocument,
  type CanvasNode,
  computeGroupBounds,
} from "@talweg/core";
import { renderOrthogonalEdge } from "@talweg/router";

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
  const nodes = Object.values(document.nodes).filter((node) => node.type !== "arrow");
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
  ctx.fillStyle = "#090d16";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const originX = bounds.minX - padding;
  const originY = bounds.minY - padding;

  // Grid dots
  ctx.fillStyle = "#1e293b";
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
  const arrowNodes = Object.values(document.nodes).filter(
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
        strokeWidth: 2,
      },
    );

    ctx.save();
    ctx.translate(-originX, -originY);

    const path = new Path2D(rendered.lineSvgPath);
    ctx.strokeStyle = arrow.style.strokeColor ?? "#38bdf8";
    ctx.lineWidth = 2;
    ctx.stroke(path);

    if (rendered.endMarkerSvg) {
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

  const g = ctx;
  const drawCenteredLabel = (
    text: string,
    x: number,
    y: number,
    fontSize: number,
    color: string,
    maxWidth: number,
  ): void => {
    g.fillStyle = color;
    g.font = `500 ${String(fontSize)}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";

    const lines = text.split("\n");
    const lineHeight = fontSize * 1.3;
    const totalHeight = lines.length * lineHeight;
    const startY = y - totalHeight / 2 + lineHeight / 2;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line !== undefined) {
        g.fillText(line, x, startY + i * lineHeight, maxWidth);
      }
    }
  };

  // Draw nodes
  for (const node of nodes) {
    const rx = node.x - originX;
    const ry = node.y - originY;
    const rw = node.width;
    const rh = node.height;

    ctx.save();
    if (node.rotation !== 0) {
      ctx.translate(rx + rw / 2, ry + rh / 2);
      ctx.rotate((node.rotation * Math.PI) / 180);
      ctx.translate(-(rx + rw / 2), -(ry + rh / 2));
    }

    if (node.type === "rectangle" || node.type === "diamond" || node.type === "capsule" || node.type === "cylinder") {
      ctx.fillStyle = node.style.fillColor ?? "#1e293b";
      ctx.strokeStyle = node.style.strokeColor ?? "#38bdf8";
      ctx.lineWidth = node.style.strokeWidth ?? 1.5;
      const radius = typeof node.style.cornerRadius === "number" ? node.style.cornerRadius : 8;
      const label = typeof node.data?.label === "string" ? node.data.label : "";
      const fontSize = node.style.fontSize ?? 13;

      if (node.type === "rectangle") {
        ctx.beginPath();
        ctx.roundRect(rx, ry, rw, rh, radius);
        ctx.fill();
        ctx.stroke();
        if (label) drawCenteredLabel(label, rx + rw / 2, ry + rh / 2, fontSize, node.style.textColor ?? "#f8fafc", rw - 12);
      } else if (node.type === "diamond") {
        const cx = rx + rw / 2;
        const cy = ry + rh / 2;
        ctx.beginPath();
        ctx.moveTo(cx, ry);
        ctx.lineTo(rx + rw, cy);
        ctx.lineTo(cx, ry + rh);
        ctx.lineTo(rx, cy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // the rhombus narrows towards the corners, keep text inside its middle band
        if (label) drawCenteredLabel(label, cx, cy, Math.min(fontSize, 12), node.style.textColor ?? "#f8fafc", rw * 0.6);
      } else if (node.type === "capsule") {
        ctx.beginPath();
        ctx.roundRect(rx, ry, rw, rh, Math.min(rw, rh) / 2);
        ctx.fill();
        ctx.stroke();
        if (label) drawCenteredLabel(label, rx + rw / 2, ry + rh / 2, fontSize, node.style.textColor ?? "#f8fafc", rw - 12);
      } else {
        // cylinder: top ellipse, side walls and a bulging bottom
        const capH = Math.min(rh * 0.22, 16);
        const cx = rx + rw / 2;
        const halfW = rw / 2;

        ctx.beginPath();
        ctx.moveTo(rx, ry + capH);
        ctx.lineTo(rx, ry + rh - capH);
        ctx.ellipse(cx, ry + rh - capH, halfW, capH, 0, Math.PI, 0, true);
        ctx.lineTo(rx + rw, ry + capH);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(cx, ry + capH, halfW, capH, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (label) drawCenteredLabel(label, cx, ry + rh / 2 + capH / 2, fontSize, node.style.textColor ?? "#f8fafc", rw - 12);
      }
    } else if (node.type === "sticker") {
      ctx.fillStyle = node.style.fillColor ?? "#fef08a";
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, 4);
      ctx.fill();

      ctx.fillStyle = node.style.textColor ?? "#713f12";
      ctx.font = "14px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      const lines = node.data.content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line !== undefined) {
          ctx.fillText(line, rx + 16, ry + 16 + i * 20);
        }
      }
    } else if (node.type === "card") {
      ctx.fillStyle = node.style.fillColor ?? "#111827";
      ctx.strokeStyle = node.style.strokeColor ?? "#374151";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, 12);
      ctx.fill();
      ctx.stroke();

      // Title
      ctx.fillStyle = node.style.textColor ?? "#f3f4f6";
      ctx.font = "600 15px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(node.data.title, rx + 16, ry + 16);

      // Status pill
      const status = node.data.status ?? "todo";
      const statusColors: Record<string, { bg: string; text: string }> = {
        todo: { bg: "#374151", text: "#e5e7eb" },
        in_progress: { bg: "#0369a1", text: "#bae6fd" },
        done: { bg: "#065f46", text: "#a7f3d0" },
        blocked: { bg: "#991b1b", text: "#fecaca" },
      };
      const colors = statusColors[status] ?? statusColors.todo ?? { bg: "#374151", text: "#e5e7eb" };

      ctx.fillStyle = colors.bg;
      ctx.beginPath();
      ctx.roundRect(rx + 16, ry + 44, 90, 22, 11);
      ctx.fill();

      ctx.fillStyle = colors.text;
      ctx.font = "500 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(status.replace("_", " ").toUpperCase(), rx + 61, ry + 55);

      // Description
      if (node.data.description) {
        ctx.fillStyle = "#9ca3af";
        ctx.font = "13px system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(node.data.description, rx + 16, ry + 78, rw - 32);
      }
    }

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
