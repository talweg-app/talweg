import { connectorAppearance } from "../utils/sceneAppearance.js";
import { createPortal } from "react-dom";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CameraViewport, CanvasDocument, NodeId } from "@talweg/core";
import { applyPeerPreviews, type Presence, type PeerEditing } from "../utils/collaborationPresence.js";
import { groupBounds, worldDocument } from "../utils/organizeCanvas.js";
import { buildPortSlotMap, computeConnectorGeometry } from "../utils/connectorGeometry.js";
import { createFreehand } from "../utils/freehand.js";
import { editableRangeRects } from "../utils/peerText.js";
import { useTheme } from "../hooks/useTheme.js";
import { useTranslation } from "../hooks/useTranslation.js";
import { FreehandRenderer } from "./FreehandRenderer.js";

function RemoteTextRange({ editing, color, document: scene, camera }: { editing: PeerEditing; color: string; document: CanvasDocument; camera: CameraViewport }) {
  const layer = useRef<HTMLDivElement>(null);
  const [rects, setRects] = useState<{ left: number; top: number; width: number; height: number }[]>([]);
  useLayoutEffect(() => {
    const measure = () => {
      const bounds = layer.current?.getBoundingClientRect();
      const root = window.document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(editing.nodeId)}"] [data-presence-field="${CSS.escape(editing.field)}"], [data-presence-node="${CSS.escape(editing.nodeId)}"] [data-presence-field="${CSS.escape(editing.field)}"]`);
      if (!bounds || !root) { setRects([]); return; }
      const pieces = editableRangeRects(root, editing.start, editing.end);
      const editor = root.getBoundingClientRect();
      setRects(pieces.slice(0, 100).map(rect => ({
        left: (editing.start === editing.end && editing.start > 0 && rect.width > 1 && !(root instanceof HTMLTextAreaElement) && !(root instanceof HTMLInputElement) ? rect.right : rect.left) - bounds.left,
        top: rect.top - bounds.top,
        width: editing.start === editing.end ? 2 : Math.max(1, Math.min(rect.right, editor.right) - Math.max(rect.left, editor.left)),
        height: rect.height || 16,
      })));
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [editing, scene, camera]);
  return createPortal(<div ref={layer} className="remote-text-layer" aria-hidden="true">{rects.map((rect, index) => <span key={index} data-testid={editing.start === editing.end ? "remote-caret" : "remote-text-selection"} className={editing.start === editing.end ? "remote-caret" : "remote-text-selection"} style={{ ...rect, background: color }} />)}</div>, window.document.body);
}

export function RemotePresence({ document, camera, pageId, peers, showCursors }: { document: CanvasDocument; camera: CameraViewport; pageId: string; peers: readonly Presence[]; showCursors: boolean }) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const world = useMemo(() => applyPeerPreviews(worldDocument(document), peers, pageId), [document, peers, pageId]);
  const ports = useMemo(() => buildPortSlotMap(world), [world]);
  const transform = `matrix(${String(camera.zoom)},0,0,${String(camera.zoom)},${String(camera.x * camera.zoom)},${String(camera.y * camera.zoom)})`;
  return <div className="remote-presence-layer" aria-hidden="true">{peers.filter(peer => peer.pageId === pageId).map((peer, peerIndex) => {
    const color = connectorAppearance(peer.color, theme);
    const padding = 5 + peerIndex * 3;
    const selected = [...new Set([...peer.selected, ...(peer.editing ? [peer.editing.nodeId] : [])])];
    const ink = peer.gesture?.kind === "ink" ? createFreehand(peer.gesture.points, `preview-${peer.id}` as NodeId, peer.gesture.color, peer.gesture.width, theme) : null;
    return <div key={peer.id}>
      {showCursors && peer.x !== null && peer.y !== null && <div className="remote-cursor" data-testid="remote-cursor" style={{ left: (peer.x + camera.x) * camera.zoom, top: (peer.y + camera.y) * camera.zoom, color }}>
        <svg width="15" height="20"><path d="M1 1L13 12L7 13L4 18Z" fill="currentColor" stroke="var(--canvas-bg)" /></svg><span style={{ background: peer.color }}>{peer.name}</span>
      </div>}
      {selected.map((id, index) => {
        const node = world.nodes[id as NodeId];
        if (!node || !node.isVisible || (node.pageId ?? "page-1") !== pageId) return null;
        const editing = peer.editing?.nodeId === id;
        const label = editing ? `${peer.name} · ${t("collaboration.editing")}` : peer.name;
        if (node.type === "arrow") {
          const geometry = computeConnectorGeometry(node, world, ports);
          if (!geometry) return null;
          return <div key={id}>
            <svg className="remote-arrow-layer" style={{ transform }}><path data-testid="remote-arrow-selection" d={geometry.lineSvgPath} fill="none" stroke={color} strokeWidth={6} strokeOpacity={.55} vectorEffect="non-scaling-stroke" /></svg>
            <span className="remote-selection-name" style={{ left: (geometry.midpoint.x + camera.x) * camera.zoom, top: (geometry.midpoint.y + camera.y) * camera.zoom - 24, background: peer.color }}>{label}</span>
          </div>;
        }
        const box = node.type === "group" ? groupBounds(world, node) : node;
        return <div key={id} className="remote-selection" data-testid="remote-selection" data-peer-node={id} style={{
          left: (box.x + camera.x) * camera.zoom - padding, top: (box.y + camera.y) * camera.zoom - padding,
          width: box.width * camera.zoom + padding * 2, height: box.height * camera.zoom + padding * 2, borderColor: color,
          transform: node.type === "group" ? undefined : `rotate(${String(node.rotation)}deg)`,
        }}>{(index === 0 || editing) && <span className="remote-selection-name" style={{ background: peer.color }}>{label}</span>}</div>;
      })}
      {peer.gesture?.kind === "marquee" && <div className="remote-marquee" data-testid="remote-marquee" style={{ left: (peer.gesture.x + camera.x) * camera.zoom, top: (peer.gesture.y + camera.y) * camera.zoom, width: peer.gesture.width * camera.zoom, height: peer.gesture.height * camera.zoom, borderColor: color, background: `${peer.color}18` }} />}
      {ink && <div data-testid="remote-ink" className="remote-ink-layer" style={{ transform }}><FreehandRenderer node={ink} preview /></div>}
      {peer.editing && <RemoteTextRange editing={peer.editing} color={color} document={world} camera={camera} />}
    </div>;
  })}</div>;
}
