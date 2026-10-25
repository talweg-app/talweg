import * as Y from "yjs";
import {
  SCENE_META_KEY,
  SCENE_NODES_KEY,
  toPlainValue,
  toYValue,
  yDocToDocument,
} from "@talweg/storage";
import type { CanvasNode, NodeId, TableNode } from "@talweg/core";

function isMap(value: unknown): value is Y.Map<unknown> {
  return value instanceof Y.Map;
}

export function editSharedText(text: Y.Text, next: string): void {
  const previous = text.toJSON();
  if (previous === next) return;
  let start = 0;
  while (
    start < previous.length &&
    start < next.length &&
    previous[start] === next[start]
  )
    start++;
  let end = 0;
  while (
    end < previous.length - start &&
    end < next.length - start &&
    previous[previous.length - end - 1] === next[next.length - end - 1]
  )
    end++;
  const removed = previous.length - start - end;
  if (removed) text.delete(start, removed);
  const inserted = next.slice(start, next.length - end);
  if (inserted) text.insert(start, inserted);
}
export function patchSharedMap(
  map: Y.Map<unknown>,
  fields: Record<string, unknown>,
): void {
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    const previous = map.get(key);
    if (JSON.stringify(toPlainValue(previous)) === JSON.stringify(value))
      continue;
    if (previous instanceof Y.Text && typeof value === "string")
      editSharedText(previous, value);
    else if (
      isMap(previous) &&
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    )
      patchSharedMap(previous, value as Record<string, unknown>);
    else if (
      typeof value === "string" &&
      ["note", "label", "text", "title", "content"].includes(key)
    )
      map.set(key, new Y.Text(value));
    else map.set(key, toYValue(value));
  }
}
function seedTable(data: Y.Map<unknown>, node: TableNode) {
  if (data.get("cells") instanceof Y.Map) return;
  const rows =
    node.data.rowIds ?? node.data.cells.map(() => crypto.randomUUID());
  const columns =
    node.data.columnIds ??
    Array.from({ length: node.data.cells[0]?.length ?? 1 }, () =>
      crypto.randomUUID(),
    );
  const rowOrder = new Y.Array<string>();
  rowOrder.push(rows);
  const columnOrder = new Y.Array<string>();
  columnOrder.push(columns);
  data.set("rowIds", rowOrder);
  data.set("columnIds", columnOrder);
  const cells = new Y.Map<Y.Map<Y.Text>>();
  data.set("cells", cells);
  for (const [r, rowId] of rows.entries()) {
    const row = new Y.Map<Y.Text>();
    cells.set(rowId, row);
    for (const [c, columnId] of columns.entries())
      row.set(columnId, new Y.Text(node.data.cells[r]?.[c] ?? ""));
  }
}
export function upgradeSharedScene(scene: Y.Doc): void {
  const document = yDocToDocument(scene);
  const nodes = scene.getMap<Y.Map<unknown>>(SCENE_NODES_KEY);
  for (const node of Object.values(document.nodes)) {
    const stored = nodes.get(node.id);
    if (!stored) continue;
    if (
      typeof node.note === "string" &&
      !(stored.get("note") instanceof Y.Text)
    )
      stored.set("note", new Y.Text(node.note));
    const data = stored.get("data");
    if (!isMap(data)) continue;
    if (node.type === "table") seedTable(data, node);
    for (const key of ["label", "text", "title", "content"]) {
      const value = data.get(key);
      if (typeof value === "string") data.set(key, new Y.Text(value));
    }
  }
  scene.getMap(SCENE_META_KEY).set("schemaVersion", 2);
}
export function editTableCell(
  scene: Y.Doc,
  id: NodeId,
  rowId: string,
  columnId: string,
  next: string,
): boolean {
  const node = scene.getMap<Y.Map<unknown>>(SCENE_NODES_KEY).get(id);
  const data = node?.get("data");
  if (!isMap(data)) return false;
  const cells = data.get("cells");
  if (!isMap(cells)) return false;
  const row = cells.get(rowId);
  if (!isMap(row)) return false;
  const rows = data.get("rowIds");
  const columns = data.get("columnIds");
  if (
    !(rows instanceof Y.Array) ||
    !(columns instanceof Y.Array) ||
    !rows.toArray().includes(rowId) ||
    !columns.toArray().includes(columnId)
  )
    return false;
  const text = row.get(columnId);
  if (text instanceof Y.Text) editSharedText(text, next);
  else row.set(columnId, new Y.Text(next));
  return true;
}
export function resizeSharedTable(
  scene: Y.Doc,
  node: TableNode,
  next: string[][],
): boolean {
  const stored = scene.getMap<Y.Map<unknown>>(SCENE_NODES_KEY).get(node.id);
  const data = stored?.get("data");
  if (!isMap(data)) return false;
  seedTable(data, node);
  const rows = data.get("rowIds") as Y.Array<string>;
  const columns = data.get("columnIds") as Y.Array<string>;
  const cells = data.get("cells") as Y.Map<Y.Map<Y.Text>>;
  const wantedColumns = next[0]?.length ?? 1;
  if (next.length < rows.length)
    rows.delete(next.length, rows.length - next.length);
  while (rows.length < next.length) {
    const id = crypto.randomUUID();
    rows.push([id]);
    cells.set(id, new Y.Map<Y.Text>());
  }
  if (wantedColumns < columns.length)
    columns.delete(wantedColumns, columns.length - wantedColumns);
  while (columns.length < wantedColumns) columns.push([crypto.randomUUID()]);
  for (const [r, rowId] of rows.toArray().entries()) {
    const row = cells.get(rowId);
    if (!row) continue;
    for (const [c, columnId] of columns.toArray().entries()) {
      const text = row.get(columnId);
      const value = next[r]?.[c] ?? "";
      if (text) editSharedText(text, value);
      else row.set(columnId, new Y.Text(value));
    }
  }
  return true;
}
export function upgradeAddedNode(scene: Y.Doc, node: CanvasNode) {
  if (node.type === "table" || node.note || node.data)
    upgradeSharedScene(scene);
}
export function changeTableStructure(
  scene: Y.Doc,
  id: NodeId,
  action: { kind: string; id: string },
): void {
  const data = scene
    .getMap<Y.Map<unknown>>(SCENE_NODES_KEY)
    .get(id)
    ?.get("data");
  if (!isMap(data)) return;
  const rows = data.get("rowIds") as Y.Array<string>;
  const columns = data.get("columnIds") as Y.Array<string>;
  const cells = data.get("cells") as Y.Map<Y.Map<Y.Text>>;
  if (action.kind === "addRow") {
    const row = new Y.Map<Y.Text>();
    cells.set(action.id, row);
    for (const column of columns.toArray()) row.set(column, new Y.Text());
    rows.push([action.id]);
  }
  if (action.kind === "addColumn") {
    for (const row of cells.values()) row.set(action.id, new Y.Text());
    columns.push([action.id]);
  }
  if (action.kind === "removeRow" && rows.length > 1) {
    const index = rows.toArray().indexOf(action.id);
    if (index >= 0) rows.delete(index);
  }
  if (action.kind === "removeColumn" && columns.length > 1) {
    const index = columns.toArray().indexOf(action.id);
    if (index >= 0) columns.delete(index);
  }
}
export function pasteTableGrid(
  scene: Y.Doc,
  id: NodeId,
  rowId: string,
  columnId: string,
  text: string,
): void {
  const data = scene
    .getMap<Y.Map<unknown>>(SCENE_NODES_KEY)
    .get(id)
    ?.get("data");
  if (!isMap(data)) return;
  const rows = data.get("rowIds") as Y.Array<string>;
  const columns = data.get("columnIds") as Y.Array<string>;
  const firstRow = rows.toArray().indexOf(rowId);
  const firstColumn = columns.toArray().indexOf(columnId);
  if (firstRow < 0 || firstColumn < 0) return;
  const grid = text
    .replaceAll("\r\n", "\n")
    .replace(/\n$/, "")
    .split("\n")
    .map((row) => row.split("\t"));
  if (
    grid.length > 1000 ||
    grid.reduce((count, row) => count + row.length, 0) > 10000
  )
    throw new Error("Range too large");
  while (rows.length < firstRow + grid.length)
    changeTableStructure(scene, id, {
      kind: "addRow",
      id: crypto.randomUUID(),
    });
  const width = Math.max(...grid.map((row) => row.length));
  while (columns.length < firstColumn + width)
    changeTableStructure(scene, id, {
      kind: "addColumn",
      id: crypto.randomUUID(),
    });
  for (const [r, values] of grid.entries())
    for (const [c, value] of values.entries()) {
      const row = rows.get(firstRow + r);
      const column = columns.get(firstColumn + c);
      editTableCell(scene, id, row, column, value);
    }
}
