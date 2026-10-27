import { computeConnectorGeometry } from "./connectorGeometry.js";
import { describe, expect, it } from "vitest";
import type { NodeId } from "@talweg/core";
import { applyPeerPreviews, validPresence, type Presence } from "./collaborationPresence.js";
import { createMicroservicesTemplate } from "./starterTemplates.js";
import { groupSelection, groupBounds, worldDocument } from "./organizeCanvas.js";
const peer: Presence = { id: "guest", name: "Guest", color: "#8caecc", pageId: "page-1", x: 10, y: 20, selected: [] };
describe("collaboration presence", () => {
  it("accepts legacy and bounded gesture packets and rejects malformed or excessive transient data", () => {
    expect(validPresence(peer)).toBe(true);
    for (const gesture of [
      { kind: "move", boxes: [{ id: "a", x: 0, y: 0, width: 200, height: 80 }] },
      { kind: "resize", boxes: [] },
      { kind: "marquee", x: 0, y: 0, width: 300, height: 80 },
      { kind: "ink", points: [{ x: 0, y: 0 }], color: null, width: 2 },
    ]) expect(validPresence({ ...peer, gesture })).toBe(true);
    for (const change of [
      { x: Infinity }, { selected: [1] }, { selected: Array<string>(1001).fill("a") }, { name: {} }, { color: "url(bad)" },
      { gesture: { kind: "move", boxes: [{ id: "a", x: NaN, y: 0, width: 1, height: 1 }] } },
      { gesture: { kind: "marquee", x: 0, y: 0, width: -1, height: 2 } },
      { gesture: { kind: "ink", points: Array(257).fill({ x: 0, y: 0 }), color: null, width: 2 } },
      { editing: { nodeId: "a", field: "label", start: 20, end: 10 } },
    ]) expect(validPresence({ ...peer, ...change })).toBe(false);
    expect(validPresence({ ...peer, editing: { nodeId: "a", field: "label", start: 0, end: 10 } })).toBe(true);
  });
  it("moves grouped descendants in world space without mutating the saved document, and respects page and local gesture ownership", () => {
    const original = createMicroservicesTemplate();
    const ids = Object.values(original.nodes).filter(node => node.type !== "arrow").slice(0, 2).map(node => node.id);
    const groupId = "shared-group" as NodeId;
    const grouped = groupSelection(original, new Set(ids), groupId, "Shared");
    const world = worldDocument(grouped);
    const group = world.nodes[groupId];
    if (!group) throw new Error("Missing group");
    const presence: Presence = { ...peer, gesture: { kind: "move", boxes: [{ id: groupId, x: group.x + 100, y: group.y - 30, width: group.width, height: group.height }] } };
    const next = applyPeerPreviews(world, [presence], "page-1");
    const previewGroup = next.nodes[groupId];
    if (!previewGroup) throw new Error("Missing preview group");
    expect(groupBounds(next, previewGroup).x).toBe(groupBounds(world, group).x + 100);
    for (const id of ids) expect(next.nodes[id]?.x).toBe((world.nodes[id]?.x ?? 0) + 100);
    expect(worldDocument(grouped)).toEqual(world);
    expect(applyPeerPreviews(world, [presence], "page-other")).toEqual(world);
    expect(applyPeerPreviews(world, [presence], "page-1", new Set([groupId]))).toEqual(world);
  });
  it("previews resize with scaled text and restores exact saved geometry when the preview clears", () => {
    const world = worldDocument(createMicroservicesTemplate());
    const node = Object.values(world.nodes).find(node => node.type === "rectangle");
    if (!node) throw new Error("Missing shape");
    const next = applyPeerPreviews(world, [{ ...peer, gesture: { kind: "resize", boxes: [{ id: node.id, x: node.x, y: node.y, width: node.width * 2, height: node.height * 2 }] } }], "page-1");
    expect(next.nodes[node.id]?.width).toBe(node.width * 2);
    expect(next.nodes[node.id]?.style.fontSize).toBe((node.style.fontSize ?? 14) * 2);
    expect(applyPeerPreviews(world, [{ ...peer, gesture: null }], "page-1")).toBe(world);
  });
  it("keeps an automatic connector attached to the same sides while a peer drags past its source", () => {
    const world = worldDocument(createMicroservicesTemplate());
    const rectangles = Object.values(world.nodes).filter(node => node.type === "rectangle");
    const source = rectangles[0], target = rectangles[1];
    const originalArrow = Object.values(world.nodes).find(node => node.type === "arrow");
    if (!source || !target || originalArrow?.type !== "arrow") throw new Error("Missing diagram");
    const arrow = { ...originalArrow, data: { sourceId: source.id, targetId: target.id, curveStyle: "orthogonal" as const, endArrow: "arrow" as const } };
    world.nodes = { [source.id]: { ...source, x: 0, y: 0 }, [target.id]: { ...target, x: 400, y: 0 }, [arrow.id]: arrow };
    expect(computeConnectorGeometry(arrow, world, new Map())?.sourcePoint.x).toBe(source.width);
    const next = applyPeerPreviews(world, [{ ...peer, gesture: { kind: "move", boxes: [{ id: target.id, x: -400, y: 0, width: target.width, height: target.height }] } }], "page-1");
    const rendered = next.nodes[arrow.id];
    if (rendered?.type !== "arrow") throw new Error("Missing preview arrow");
    expect(computeConnectorGeometry(rendered, next, new Map())?.sourcePoint.x).toBe(source.width);
  });

});
