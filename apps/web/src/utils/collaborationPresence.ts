import { stabilizeConnections } from "./connectorGeometry.js";
import type { CanvasDocument, NodeId, Point2D } from "@talweg/core";
import { descendantIds, movedWorldDocument } from "./organizeCanvas.js";
import { resizeNodeContent } from "./resizeNodeContent.js";

export interface PreviewBox { id: string; x: number; y: number; width: number; height: number }
export type PeerGesture =
  | { kind: "move" | "resize"; boxes: PreviewBox[] }
  | { kind: "ink"; points: Point2D[]; color: string | null; width: number }
  | { kind: "marquee"; x: number; y: number; width: number; height: number };
export interface PeerEditing { nodeId: string; field: string; start: number; end: number }
export interface Presence {
  id: string; name: string; color: string; pageId: string;
  x: number | null; y: number | null; selected: string[];
  gesture?: PeerGesture | null;
  editing?: PeerEditing | null;
}
export type PresencePatch = Partial<Omit<Presence, "id" | "name" | "color">>;
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1e8;
const identifier = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 200;
const box = (value: unknown) => record(value) && finite(value.x) && finite(value.y) && finite(value.width) && finite(value.height) && value.width >= 0 && value.height >= 0;
export function validPresence(value: unknown): value is Presence {
  if (!record(value) || !identifier(value.id) || typeof value.name !== "string" || value.name.length > 80 || typeof value.color !== "string" || !/^#[\da-f]{6}$/i.test(value.color) || !identifier(value.pageId) || !Array.isArray(value.selected) || value.selected.length > 1000 || !value.selected.every(identifier) || (value.x !== null && !finite(value.x)) || (value.y !== null && !finite(value.y))) return false;
  const gesture = value.gesture;
  if (gesture != null) {
    if (!record(gesture)) return false;
    if (gesture.kind === "move" || gesture.kind === "resize") {
      if (!Array.isArray(gesture.boxes) || gesture.boxes.length > 1000 || !gesture.boxes.every(item => box(item) && record(item) && identifier(item.id))) return false;
    } else if (gesture.kind === "ink") {
      if (!Array.isArray(gesture.points) || !gesture.points.length || gesture.points.length > 256 || !gesture.points.every(point => record(point) && finite(point.x) && finite(point.y)) || !finite(gesture.width) || gesture.width <= 0 || gesture.width > 100 || (gesture.color !== null && (typeof gesture.color !== "string" || !/^#[\da-f]{3,8}$/i.test(gesture.color)))) return false;
    } else if (gesture.kind !== "marquee" || !box(gesture)) return false;
  }
  const editing = value.editing;
  return editing == null || (record(editing) && identifier(editing.nodeId) && identifier(editing.field) && Number.isSafeInteger(editing.start) && Number.isSafeInteger(editing.end) && typeof editing.start === "number" && typeof editing.end === "number" && editing.start >= 0 && editing.end >= editing.start && editing.end <= 10000000);
}

export function applyPeerPreviews(world: CanvasDocument, peers: readonly Presence[], pageId: string, excluded: ReadonlySet<NodeId> = new Set()): CanvasDocument {
  let next = world;
  const owned = new Set([...excluded].flatMap(id => [...descendantIds(world, id)]));
  for (const peer of peers) {
    if (peer.pageId !== pageId || !peer.gesture || !("boxes" in peer.gesture)) continue;
    const boxes = peer.gesture.boxes.filter(item => !owned.has(item.id as NodeId) && (next.nodes[item.id as NodeId]?.pageId ?? "page-1") === pageId);
    if (!boxes.length) continue;
    next = stabilizeConnections(next);
    if (peer.gesture.kind === "move") next = movedWorldDocument(next, new Map(boxes.map(item => [item.id as NodeId, { x: item.x, y: item.y }])));
    else {
      const nodes = { ...next.nodes };
      for (const item of boxes) {
        const node = nodes[item.id as NodeId];
        if (node && node.type !== "arrow" && node.type !== "group") nodes[node.id] = { ...resizeNodeContent(node, { ...item, rotation: node.rotation * Math.PI / 180 }), x: item.x, y: item.y, width: item.width, height: item.height };
      }
      next = { ...next, nodes };
    }
  }
  return next;
}
