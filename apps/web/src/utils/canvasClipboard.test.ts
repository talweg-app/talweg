import { expect, it } from "vitest";
import type { NodeId } from "@talweg/core";
import { IndexedDBStorageAdapter } from "@talweg/storage";
import {
  createBlankCanvas,
  createMicroservicesTemplate,
} from "./starterTemplates.js";
import {
  copyFragment,
  parseFragment,
  pasteFragment,
  FRAGMENT_PREFIX,
} from "./canvasClipboard.js";

it("copies an independent diagram with internal connections and one new page", async () => {
  const source = createMicroservicesTemplate();
  const original = structuredClone(source);
  const fragment = parseFragment(
    await copyFragment(
      source,
      new Set(Object.keys(source.nodes) as NodeId[]),
      new IndexedDBStorageAdapter(),
    ),
  );
  const destination = createBlankCanvas();
  const pasted = pasteFragment(destination, fragment, "page-2", {
    x: 100,
    y: 200,
  });
  expect(Object.keys(pasted.document.nodes)).toHaveLength(
    Object.keys(source.nodes).length,
  );
  for (const node of Object.values(pasted.document.nodes)) {
    expect(source.nodes[node.id]).toBeUndefined();
    expect(node.pageId).toBe("page-2");
    if (node.type === "arrow") {
      expect(pasted.document.nodes[node.data.sourceId]).toBeDefined();
      expect(pasted.document.nodes[node.data.targetId]).toBeDefined();
    }
  }
  expect(source).toEqual(original);
  expect(destination.nodes).toEqual({});
});
it("copying an arrow includes its endpoints without pulling in the entire graph", async () => {
  const source = createMicroservicesTemplate();
  const arrow = Object.values(source.nodes).find(
    (node) => node.type === "arrow",
  );
  if (!arrow) throw new Error("Missing template arrow");
  const fragment = parseFragment(
    await copyFragment(
      source,
      new Set([arrow.id]),
      new IndexedDBStorageAdapter(),
    ),
  );
  expect(fragment.nodes.filter((node) => node.type !== "arrow")).toHaveLength(
    2,
  );
});
it("rejects unsupported nodes and broken group references before any mutation", () => {
  for (const nodes of [
    [{ id: "bad", type: "script" }],
    [
      {
        id: "bad",
        type: "group",
        x: 0,
        y: 0,
        width: 20,
        height: 20,
        rotation: 0,
        zIndex: 1,
        opacity: 1,
        parentId: "bad",
        style: {},
        data: { childIds: ["bad"] },
      },
    ],
  ]) {
    expect(() =>
      parseFragment(
        FRAGMENT_PREFIX +
          JSON.stringify({
            version: 1,
            source: "test",
            roots: ["bad"],
            assets: [],
            nodes,
          }),
      ),
    ).toThrow();
  }
});
