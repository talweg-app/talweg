import React from "react";
import type { CameraViewport, CanvasNode, ResizeHandle } from "@talweg/core";

export interface SelectionBoxProps {
  node: CanvasNode;
  camera: CameraViewport;
  onResizeStart: (
    e: React.PointerEvent<HTMLDivElement>,
    handle: ResizeHandle,
    node: CanvasNode,
  ) => void;
}

const HANDLE_ANGLES: Record<ResizeHandle, number> = {
  n: 0,
  ne: 45,
  e: 90,
  se: 135,
  s: 180,
  sw: 225,
  w: 270,
  nw: 315,
};

export function getResizeCursor(handle: ResizeHandle, rotationDeg = 0): string {
  const baseAngle = HANDLE_ANGLES[handle];
  const totalAngle = (((baseAngle + rotationDeg) % 360) + 360) % 360;
  const index = Math.floor(((totalAngle + 22.5) % 360) / 45);
  const cursors = [
    "ns-resize",
    "nesw-resize",
    "ew-resize",
    "nwse-resize",
    "ns-resize",
    "nesw-resize",
    "ew-resize",
    "nwse-resize",
  ];
  return cursors[index] ?? "pointer";
}

const HANDLES: readonly { handle: ResizeHandle; left: string; top: string }[] = [
  { handle: "nw", left: "0%", top: "0%" },
  { handle: "n", left: "50%", top: "0%" },
  { handle: "ne", left: "100%", top: "0%" },
  { handle: "e", left: "100%", top: "50%" },
  { handle: "se", left: "100%", top: "100%" },
  { handle: "s", left: "50%", top: "100%" },
  { handle: "sw", left: "0%", top: "100%" },
  { handle: "w", left: "0%", top: "50%" },
];

export function SelectionBox({ node, camera, onResizeStart }: SelectionBoxProps) {
  const scale = 1 / camera.zoom;
  const borderWidth = Math.max(1, Math.round(1.5 * scale));

  return (
    <div
      data-node-id={node.id}
      style={{
        transform: `translate3d(${String(node.x)}px, ${String(node.y)}px, 0px) rotate(${String(node.rotation)}deg)`,
        width: node.width,
        height: node.height,
        zIndex: 60,
      }}
      className="absolute pointer-events-none"
    >
      {/* Bounding box outline */}
      <div
        className="absolute inset-0 border border-amber-500/80 pointer-events-none"
        style={{
          borderWidth: `${String(borderWidth)}px`,
        }}
      />

      {/* 8-point resize handles */}
      {HANDLES.map(({ handle, left, top }) => {
        const cursor = getResizeCursor(handle, node.rotation);
        return (
          <div
            key={handle}
            data-handle={handle}
            className="absolute w-2 h-2 bg-neutral-950 border border-amber-400 rounded-[1px] shadow-sm pointer-events-auto hover:bg-amber-400 transition-colors"
            style={{
              left,
              top,
              transform: `translate(-50%, -50%) scale(${String(scale)})`,
              cursor,
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (e.button !== 0) return;
              onResizeStart(e, handle, node);
            }}
          />
        );
      })}
    </div>
  );
}
