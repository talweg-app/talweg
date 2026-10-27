import * as Y from "yjs";
import { expect, it } from "vitest";
import {
  createSceneDoc,
  yDocToDocument,
  SCENE_NODES_KEY,
  toYValue,
} from "@talweg/storage";
import type { NodeId, TableNode } from "@talweg/core";
import { createBlankCanvas } from "./starterTemplates.js";
import {
  changeTableStructure,
  editTableCell,
  upgradeSharedScene,
  patchSharedMap,
  pasteTableGrid,
} from "./sharedEditing.js";

it("merges edits in different cells and concurrent row insertions", () => {
  const document = createBlankCanvas();
  const id = "table" as NodeId;
  const node: TableNode = {
    id,
    type: "table",
    x: 0,
    y: 0,
    width: 300,
    height: 200,
    rotation: 0,
    zIndex: 1,
    opacity: 1,
    isLocked: false,
    isVisible: true,
    parentId: null,
    createdAt: 1,
    updatedAt: 1,
    style: {},
    data: { cells: [["A", "B"]] },
  };
  document.nodes[id] = node;
  const host = createSceneDoc(document);
  upgradeSharedScene(host);
  const guest = new Y.Doc();
  Y.applyUpdate(guest, Y.encodeStateAsUpdate(host));
  const table = yDocToDocument(host).nodes[id] as TableNode;
  const row = table.data.rowIds?.[0];
  const [first, second] = table.data.columnIds ?? [];
  if (!row || !first || !second) throw new Error("Missing stable IDs");
  host.transact(() => {
    editTableCell(host, id, row, first, "Host");
    changeTableStructure(host, id, { kind: "addRow", id: "host-row" });
  });
  guest.transact(() => {
    editTableCell(guest, id, row, second, "Guest");
    changeTableStructure(guest, id, { kind: "addRow", id: "guest-row" });
  });
  Y.applyUpdate(host, Y.encodeStateAsUpdate(guest));
  Y.applyUpdate(guest, Y.encodeStateAsUpdate(host));
  const merged = yDocToDocument(host).nodes[id] as TableNode;
  expect(merged.data.cells[0]).toEqual(["Host", "Guest"]);
  expect(merged.data.cells).toHaveLength(3);
  expect(yDocToDocument(guest)).toEqual(yDocToDocument(host));
  host.destroy();
  guest.destroy();
});
it("patches style keys without replacing another participant’s changes", () => {
  const host = new Y.Doc();
  const map = host.getMap<Y.Map<unknown>>(SCENE_NODES_KEY);
  const node = toYValue({
    style: { fillColor: "red", strokeWidth: 1 },
  }) as Y.Map<unknown>;
  map.set("test", node);
  const guest = new Y.Doc();
  Y.applyUpdate(guest, Y.encodeStateAsUpdate(host));
  patchSharedMap(node, { style: { fillColor: "blue" } });
  const guestNode = guest.getMap<Y.Map<unknown>>(SCENE_NODES_KEY).get("test");
  if (!guestNode) throw new Error("Missing guest node");
  patchSharedMap(guestNode, { style: { strokeWidth: 5 } });
  Y.applyUpdate(host, Y.encodeStateAsUpdate(guest));
  const style = node.get("style") as Y.Map<unknown>;
  expect(style.get("fillColor")).toBe("blue");
  expect(style.get("strokeWidth")).toBe(5);
  host.destroy();
  guest.destroy();
});

it("pastes a rectangular range into stable cells and undoes the whole insertion", async () => {
  const { createCanvasNode } = await import("./createCanvasNode.js");
  const document = createBlankCanvas();
  const node = createCanvasNode("table", { x: 0, y: 0 }, "whiteboard");
  if (node?.type !== "table") throw new Error("Missing table");
  document.nodes[node.id] = node;
  const scene = createSceneDoc(document);
  upgradeSharedScene(scene);
  const table = yDocToDocument(scene).nodes[node.id] as TableNode;
  const row = table.data.rowIds?.[0];
  const column = table.data.columnIds?.[0];
  if (!row || !column) throw new Error("Missing IDs");
  const undo = new Y.UndoManager(scene.getMap(SCENE_NODES_KEY));
  scene.transact(() => {
    pasteTableGrid(
      scene,
      node.id,
      row,
      column,
      "One\tTwo\nThree\tFour\nFive\tSix\nSeven\tEight",
    );
  });
  expect(
    (yDocToDocument(scene).nodes[node.id] as TableNode).data.cells
      .slice(0, 4)
      .map((values) => values.slice(0, 2)),
  ).toEqual([
    ["One", "Two"],
    ["Three", "Four"],
    ["Five", "Six"],
    ["Seven", "Eight"],
  ]);
  undo.undo();
  expect(
    (yDocToDocument(scene).nodes[node.id] as TableNode).data.cells,
  ).toEqual(table.data.cells);
  undo.destroy();
  scene.destroy();
});
it("keeps the intersection of concurrently inserted rows and columns editable", async () => {
  const { createCanvasNode } = await import("./createCanvasNode.js");
  const document = createBlankCanvas();
  const node = createCanvasNode("table", { x: 0, y: 0 }, "whiteboard");
  if (node?.type !== "table") throw new Error("Missing table");
  document.nodes[node.id] = node;
  const host = createSceneDoc(document);
  upgradeSharedScene(host);
  const guest = new Y.Doc();
  Y.applyUpdate(guest, Y.encodeStateAsUpdate(host));
  changeTableStructure(host, node.id, { kind: "addRow", id: "new-row" });
  changeTableStructure(guest, node.id, { kind: "addColumn", id: "new-column" });
  Y.applyUpdate(host, Y.encodeStateAsUpdate(guest));
  expect(
    editTableCell(host, node.id, "new-row", "new-column", "Intersection"),
  ).toBe(true);
  expect(
    (yDocToDocument(host).nodes[node.id] as TableNode).data.cells
      .at(-1)
      ?.at(-1),
  ).toBe("Intersection");
  changeTableStructure(host, node.id, { kind: "removeRow", id: "new-row" });
  expect(
    editTableCell(host, node.id, "new-row", "new-column", "Late edit"),
  ).toBe(false);
  host.destroy();
  guest.destroy();
});

it("merges simultaneous inserts into the same label and preserves a local undo boundary", async () => {
  const { createCanvasNode } = await import("./createCanvasNode.js");
  const document = createBlankCanvas();
  const node = createCanvasNode("rectangle", { x: 0, y: 0 }, "whiteboard");
  if (node?.type !== "rectangle") throw new Error("Missing shape");
  node.data = { label: "Shared" };
  document.nodes[node.id] = node;
  const host = createSceneDoc(document); upgradeSharedScene(host);
  const guest = new Y.Doc(); Y.applyUpdate(guest, Y.encodeStateAsUpdate(host));
  const hostNode = host.getMap<Y.Map<unknown>>(SCENE_NODES_KEY).get(node.id);
  const guestNode = guest.getMap<Y.Map<unknown>>(SCENE_NODES_KEY).get(node.id);
  if (!hostNode || !guestNode) throw new Error("Missing shared nodes");
  const hostData = hostNode.get("data"), guestData = guestNode.get("data");
  if (!(hostData instanceof Y.Map) || !(guestData instanceof Y.Map)) throw new Error("Missing shared data");
  const undo = new Y.UndoManager(hostData, { trackedOrigins: new Set(["local"]) });
  host.transact(() => { patchSharedMap(hostData, { label: "Shared HOST" }); }, "local");
  guest.transact(() => { patchSharedMap(guestData, { label: "Shared GUEST" }); }, "local");
  Y.applyUpdate(host, Y.encodeStateAsUpdate(guest), "remote");
  Y.applyUpdate(guest, Y.encodeStateAsUpdate(host), "remote");
  const result = yDocToDocument(host).nodes[node.id];
  if (result?.type !== "rectangle" || !result.data) throw new Error("Missing merged shape");
  expect(result.data.label).toContain("HOST"); expect(result.data.label).toContain("GUEST");
  expect(yDocToDocument(guest).nodes[node.id]).toEqual(result);
  undo.undo();
  const undone = yDocToDocument(host).nodes[node.id];
  if (undone?.type !== "rectangle" || !undone.data) throw new Error("Missing undone shape");
  expect(undone.data.label).toContain("GUEST"); expect(undone.data.label).not.toContain("HOST");
  undo.destroy(); host.destroy(); guest.destroy();
});
