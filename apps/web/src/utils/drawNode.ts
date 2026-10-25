import { freehandPath, freehandColor } from "./freehand.js";
import type { Theme } from "../themeContext.js";
import { ensureTextContrast, resolveFillColor } from "./colorContrast.js";
import type { CanvasNode, NodeStyle, TextRun } from "@talweg/core";

export function drawNode(
  ctx: CanvasRenderingContext2D,
  node: CanvasNode,
  image?: HTMLImageElement,
  backgroundColor = "#101112",
  theme: Theme = "dark",
): void {
  const { width, height, style } = node;
  if (node.type === "freehand") {
    if (style.strokeWidth === 0 || style.strokeDash === "none") return;
    ctx.globalAlpha = node.opacity;
    ctx.strokeStyle = freehandColor(node, theme);
    ctx.lineWidth = style.strokeWidth ?? 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash(
      style.strokeDash === "dashed"
        ? [8, 5]
        : style.strokeDash === "dotted"
          ? [1, 5]
          : [],
    );
    ctx.stroke(new Path2D(freehandPath(node.data.points, width, height)));
    return;
  }

  if (node.type === "group") {
    ctx.strokeStyle = style.strokeColor ?? "#8b8f89";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(0, 0, width, height);
    ctx.setLineDash([]);
    ctx.fillStyle = ensureTextContrast(
      style.textColor ?? "#8b8f89",
      backgroundColor,
    );
    ctx.font = '500 13px "Onest Variable", sans-serif';
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(
      typeof node.meta?.title === "string" && node.meta.title
        ? node.meta.title
        : "Group",
      14,
      12,
      Math.max(1, width - 28),
    );
    return;
  }

  const radius =
    typeof style.cornerRadius === "number" ? style.cornerRadius : 6;
  const fontSize = style.fontSize ?? 14;
  const align =
    style.textAlign === "justify"
      ? "left"
      : (style.textAlign ??
        (["rectangle", "ellipse", "diamond", "capsule", "cylinder"].includes(
          node.type,
        )
          ? "center"
          : "left"));
  const textColor =
    style.textColor ?? (node.type === "sticker" ? "#422006" : "#eeeeeb");
  const fillColor =
    style.fillColor ?? (node.type === "sticker" ? "#fef9c3" : "#242729");
  const strokeWidth =
    style.strokeDash === "none" ? 0 : (style.strokeWidth ?? 1);
  ctx.globalAlpha = node.opacity;
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = style.strokeColor ?? "#727777";
  ctx.lineWidth = strokeWidth || 1;
  ctx.setLineDash(
    style.strokeDash === "dashed"
      ? [8, 5]
      : style.strokeDash === "dotted"
        ? [2, 4]
        : [],
  );

  const surface = () => {
    ctx.fill();
    if (strokeWidth > 0) ctx.stroke();
  };
  const text = (
    content: string,
    x: number,
    y: number,
    maxWidth: number,
    centered = false,
    field = "label",
    override?: NodeStyle,
  ) => {
    const paintBackground = resolveFillColor(
      override?.fillColor ?? fillColor,
      backgroundColor,
    );
    const paintColor = ensureTextContrast(
      override?.textColor ?? textColor,
      paintBackground,
    );
    const paintSize = override?.fontSize ?? fontSize;
    const paintAlign =
      override?.textAlign === "justify"
        ? "left"
        : (override?.textAlign ?? align);
    const weight = override?.fontWeight ?? style.fontWeight ?? 400;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();
    ctx.fillStyle = paintColor;
    const family = style.fontFamily ?? '"Onest Variable", sans-serif';
    ctx.font = `${String(weight === "medium" ? 500 : weight === "semibold" ? 600 : weight)} ${String(paintSize)}px ${family}`;
    ctx.textAlign = paintAlign;
    ctx.textBaseline = "alphabetic";
    const runs = node.textRuns?.[field];
    const lines = content.split("\n");
    const largestSize = Math.max(
      paintSize,
      ...(runs ?? []).map((run) => run.fontSize ?? paintSize),
    );
    const lineHeight = largestSize * 1.5;
    const metrics = ctx.measureText("Mg");
    const baseline =
      lineHeight / 2 +
      ((metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) *
        (largestSize / paintSize)) /
        2;
    const positioned = [
      "text",
      "rectangle",
      "ellipse",
      "diamond",
      "capsule",
      "cylinder",
    ].includes(node.type);
    const verticalAlign = style.verticalAlign ?? (centered ? "middle" : "top");
    const padding = node.type === "text" ? 8 : 12;
    const startY = positioned
      ? verticalAlign === "middle"
        ? (height - lines.length * lineHeight) / 2
        : verticalAlign === "bottom"
          ? height - padding - lines.length * lineHeight
          : padding
      : centered
        ? y - (lines.length * lineHeight) / 2
        : y;
    const textX =
      paintAlign === "center"
        ? x + maxWidth / 2
        : paintAlign === "right"
          ? x + maxWidth
          : x;
    let offset = 0;
    lines.forEach((line, index) => {
      const y = startY + index * lineHeight + baseline;
      if (runs?.map((run) => run.text).join("") !== content)
        ctx.fillText(line, textX, y, maxWidth);
      else {
        const fontFor = (run: TextRun) =>
          `${run.italic ? "italic " : ""}${String(run.bold === undefined ? (weight === "medium" ? 500 : weight === "semibold" ? 600 : weight) : run.bold ? 700 : 400)} ${String(run.fontSize ?? paintSize)}px ${family}`;
        let runOffset = 0;
        const fragments: { run: TextRun; fragment: string; width: number }[] =
          [];
        for (const run of runs) {
          const from = Math.max(0, offset - runOffset);
          const to = Math.min(
            run.text.length,
            offset + line.length - runOffset,
          );
          if (from < to) {
            const fragment = run.text.slice(from, to);
            ctx.font = fontFor(run);
            fragments.push({
              run,
              fragment,
              width: ctx.measureText(fragment).width,
            });
          }
          runOffset += run.text.length;
        }
        const measured = fragments.reduce(
          (sum, fragment) => sum + fragment.width,
          0,
        );
        const scale = Math.min(1, maxWidth / Math.max(measured, 1));
        const startX =
          paintAlign === "center"
            ? textX - (measured * scale) / 2
            : paintAlign === "right"
              ? textX - measured * scale
              : textX;
        ctx.save();
        ctx.translate(startX, y);
        ctx.scale(scale, 1);
        ctx.textAlign = "left";
        let advance = 0;
        for (const { run, fragment, width: fragmentWidth } of fragments) {
          ctx.font = fontFor(run);
          ctx.fillStyle = ensureTextContrast(
            run.color ?? paintColor,
            paintBackground,
          );
          ctx.fillText(fragment, advance, 0);
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = Math.max(1, (run.fontSize ?? paintSize) / 16);
          for (const position of [
            run.underline || run.href
              ? (run.fontSize ?? paintSize) * 0.12
              : null,
            run.strike ? -(run.fontSize ?? paintSize) * 0.3 : null,
          ]) {
            if (position === null) continue;
            ctx.beginPath();
            ctx.moveTo(advance, position);
            ctx.lineTo(advance + fragmentWidth, position);
            ctx.stroke();
          }
          advance += fragmentWidth;
        }
        ctx.restore();
      }
      offset += line.length + 1;
    });
    ctx.restore();
  };

  ctx.beginPath();
  if (node.type === "ellipse") {
    ctx.ellipse(
      width / 2,
      height / 2,
      width / 2,
      height / 2,
      0,
      0,
      Math.PI * 2,
    );
  } else if (node.type === "diamond") {
    ctx.moveTo(width / 2, height * 0.02);
    ctx.lineTo(width * 0.98, height / 2);
    ctx.lineTo(width / 2, height * 0.98);
    ctx.lineTo(width * 0.02, height / 2);
    ctx.closePath();
  } else if (node.type === "capsule") {
    ctx.roundRect(0, 0, width, height, Math.min(width, height) / 2);
  } else if (node.type === "cylinder") {
    const cap = height * 0.18;
    ctx.moveTo(width * 0.02, height * 0.2);
    ctx.lineTo(width * 0.02, height * 0.8);
    ctx.ellipse(
      width / 2,
      height * 0.8,
      width * 0.48,
      cap,
      0,
      Math.PI,
      0,
      true,
    );
    ctx.lineTo(width * 0.98, height * 0.2);
    ctx.closePath();
    surface();
    ctx.beginPath();
    ctx.ellipse(width / 2, height * 0.2, width * 0.48, cap, 0, 0, Math.PI * 2);
  } else {
    ctx.roundRect(0, 0, width, height, radius);
  }
  surface();

  switch (node.type) {
    case "rectangle":
    case "ellipse":
    case "diamond":
    case "capsule":
    case "cylinder":
      text(node.data?.label ?? "", 12, height / 2, width - 24, true);
      break;
    case "text":
      text(node.data.text, 8, 8, width - 16, false, "text");
      break;
    case "sticker":
      text(node.data.content, 14, 14, width - 28, false, "content");
      break;
    case "card":
      text(node.data.title, 16, 16, width - 32, false, "title");
      text(
        node.data.status?.replaceAll("_", " ") ?? "todo",
        16,
        48,
        width - 32,
      );
      text(
        node.data.description ?? "",
        16,
        80,
        width - 32,
        false,
        "description",
      );
      break;
    case "checklist":
      text(node.data.title, 16, 16, width - 32, false, "title");
      node.data.items.forEach((entry, index) => {
        const y = 52 + index * 34;
        if (y + 20 > height) return;
        ctx.beginPath();
        ctx.rect(16, y + 2, 13, 13);
        ctx.strokeStyle = ensureTextContrast(
          textColor,
          resolveFillColor(fillColor, backgroundColor),
        );
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.stroke();
        if (entry.checked) {
          ctx.beginPath();
          ctx.moveTo(18, y + 8);
          ctx.lineTo(22, y + 12);
          ctx.lineTo(28, y + 4);
          ctx.stroke();
        }
        text(entry.text, 38, y, width - 54, false, `task:${entry.id}`);
      });
      break;
    case "image": {
      if (image) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(0, 0, width, height, radius);
        ctx.clip();
        const scale = Math.min(
          width / image.naturalWidth,
          height / image.naturalHeight,
        );
        const w = image.naturalWidth * scale;
        const h = image.naturalHeight * scale;
        ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
        ctx.restore();
      }
      break;
    }
    case "markdown":
      text(node.data.title || "Markdown", 16, 16, width - 32, false, "title");
      break;
    case "table": {
      const rows = node.data.cells.length;
      const columns = node.data.cells[0]?.length ?? 1;
      const cellWidth = width / columns;
      const cellHeight = height / Math.max(rows, 1);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(0, 0, width, height, radius);
      ctx.clip();
      node.data.cells.forEach((row, r) => {
        row.forEach((cell, c) => {
          const cellKey = `${String(r)}:${String(c)}`;
          const ownStyle = node.data.cellStyles?.[cellKey];
          const cellStyle = { ...style, ...ownStyle };
          if (ownStyle?.fillColor) {
            ctx.fillStyle = ownStyle.fillColor;
            ctx.fillRect(c * cellWidth, r * cellHeight, cellWidth, cellHeight);
          }
          ctx.strokeStyle = cellStyle.strokeColor ?? "#727777";
          ctx.lineWidth = cellStyle.strokeWidth ?? 1;
          ctx.setLineDash(
            cellStyle.strokeDash === "dashed"
              ? [8, 5]
              : cellStyle.strokeDash === "dotted"
                ? [2, 4]
                : [],
          );
          if (cellStyle.strokeDash !== "none" && ctx.lineWidth > 0)
            ctx.strokeRect(
              c * cellWidth,
              r * cellHeight,
              cellWidth,
              cellHeight,
            );
          ctx.save();
          ctx.beginPath();
          ctx.rect(c * cellWidth, r * cellHeight, cellWidth, cellHeight);
          ctx.clip();
          text(
            cell,
            c * cellWidth + 10,
            r * cellHeight + 10,
            cellWidth - 20,
            false,
            `cell:${cellKey}`,
            {
              ...cellStyle,
              fontWeight: cellStyle.fontWeight ?? (r === 0 ? 600 : 400),
            },
          );
          ctx.restore();
        });
      });
      ctx.restore();
      break;
    }
  }
}
