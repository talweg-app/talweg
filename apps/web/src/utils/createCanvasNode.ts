import type { CanvasNode, Point2D } from "@talweg/core";
import type { CanvasMode, ToolType } from "../types.js";
import { createId } from "./template.js";

export function createCanvasNode(
  tool: ToolType,
  point: Point2D,
  mode: CanvasMode,
): CanvasNode | null {
  const x =
    mode === "diagrams" ? Math.round(point.x / 16) * 16 : Math.round(point.x);
  const y =
    mode === "diagrams" ? Math.round(point.y / 16) * 16 : Math.round(point.y);
  const timestamp = Date.now();
  const base = {
    id: createId(tool),
    x: x - 100,
    y: y - 40,
    width: 200,
    height: 80,
    rotation: 0,
    zIndex: 10,
    opacity: 1,
    parentId: null,
    isLocked: false,
    isVisible: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    style: {
      fillColor: "#242729",
      strokeColor: "#727777",
      strokeWidth: 1,
      cornerRadius: 6,
      textColor: "#eeeeeb",
      fontSize: 14,
    },
  };
  switch (tool) {
    case "rectangle":
      return { ...base, type: tool, data: { label: "" } };
    case "ellipse":
      return {
        ...base,
        type: tool,
        height: 120,
        y: y - 60,
        data: { label: "" },
      };
    case "diamond":
      return {
        ...base,
        type: tool,
        height: 120,
        y: y - 60,
        data: { label: "" },
      };
    case "capsule":
      return {
        ...base,
        type: tool,
        height: 56,
        y: y - 28,
        data: { label: "" },
      };
    case "cylinder":
      return {
        ...base,
        type: tool,
        height: 120,
        y: y - 60,
        data: { label: "" },
      };
    case "text":
      return {
        ...base,
        type: tool,
        style: {
          ...base.style,
          fillColor: "transparent",
          strokeWidth: 0,
          fontSize: 20,
        },
        data: { text: "", autoSize: false },
      };
    case "sticker":
      return {
        ...base,
        type: tool,
        width: 220,
        height: 200,
        x: x - 110,
        y: y - 100,
        style: {
          ...base.style,
          fillColor: "#e9dda7",
          textColor: "#343024",
          strokeColor: "#c3b77e",
          cornerRadius: 3,
        },
        data: { content: "", stickerShape: "square" },
      };
    case "card":
      return {
        ...base,
        type: tool,
        width: 320,
        height: 180,
        x: x - 160,
        y: y - 90,
        data: { title: "", description: "", status: "todo", tags: [] },
      };
    case "checklist":
      return {
        ...base,
        type: tool,
        width: 300,
        height: 240,
        x: x - 150,
        y: y - 120,
        data: {
          title: "",
          items: [{ id: crypto.randomUUID(), text: "", checked: false }],
        },
      };
    case "table":
      return {
        ...base,
        type: tool,
        width: 420,
        height: 240,
        x: x - 210,
        y: y - 120,
        data: {
          cells: [
            ["", "", ""],
            ["", "", ""],
            ["", "", ""],
          ],
        },
      };
    default:
      return null;
  }
}
