import { expect, it } from "vitest";
import type { CanvasNode } from "@talweg/core";
import { createBlankCanvas } from "./starterTemplates.js";
import { createCanvasNode } from "./createCanvasNode.js";
import { searchCanvas } from "./searchCanvas.js";

it("finds case-insensitive words in notes, table cells, tasks and group names across pages", () => {
  const document = createBlankCanvas();
  const make = (
    tool: "markdown" | "table" | "checklist" | "rectangle",
    note: string,
  ): CanvasNode => {
    const node = createCanvasNode(tool, { x: 0, y: 0 }, "whiteboard", "dark");
    if (!node) throw new Error("Missing node");
    return { ...node, note, pageId: "page-other" };
  };
  const note = make(
    "markdown",
    "Площадь треугольника равна половине произведения основания на высоту",
  );
  const table = make("table", "");
  if (table.type === "table") table.data.cells = [["Triangle area"]];
  const tasks = make("checklist", "");
  if (tasks.type === "checklist")
    tasks.data.items = [
      { id: "task", text: "Calculate triangle area", checked: false },
    ];
  document.nodes = Object.fromEntries(
    [note, table, tasks].map((node) => [node.id, node]),
  );
  expect(
    searchCanvas(document, "ПЛОЩАДЬ треугольника").map(
      (result) => result.node.id,
    ),
  ).toEqual([note.id]);
  expect(searchCanvas(document, "area triangle")).toHaveLength(2);
  expect(
    searchCanvas(document, "triangle").every(
      (result) => result.pageId === "page-other",
    ),
  ).toBe(true);
  expect(searchCanvas(document, "  ")).toEqual([]);
  expect(searchCanvas(document, tasks.id)).toEqual([]);
  document.nodes[tasks.id] = { ...tasks, isVisible: false };
  expect(searchCanvas(document, "triangle")).toHaveLength(1);
});
