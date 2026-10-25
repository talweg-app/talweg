import type { FreehandNode, NodeId } from "@talweg/core";
import { freehandColor, freehandPath } from "../utils/freehand.js";
import { useTheme } from "../hooks/useTheme.js";
import { useTranslation } from "../hooks/useTranslation.js";

export function FreehandRenderer({
  node,
  selected = false,
  preview = false,
  onSelect,
}: {
  node: FreehandNode;
  selected?: boolean;
  preview?: boolean;
  onSelect?: (id: NodeId, event: React.PointerEvent) => void;
}) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const path = freehandPath(node.data.points, node.width, node.height);
  const strokeWidth = node.style.strokeWidth ?? 3;
  return (
    <div
      data-testid={preview ? "stroke-preview" : "canvas-node"}
      data-node-id={preview ? undefined : node.id}
      data-node-type="freehand"
      data-selected={selected}
      role={preview ? undefined : "group"}
      aria-label={preview ? undefined : t("tools.freehand")}
      className={`freehand-node ${selected ? "is-selected" : ""}`}
      style={{
        transform: `translate3d(${String(node.x)}px, ${String(node.y)}px, 0) rotate(${String(node.rotation)}deg)`,
        width: node.width,
        height: node.height,
        zIndex: node.zIndex,
        opacity: node.opacity,
      }}
      onPointerDown={(event) => {
        if (!preview && (event.button === 0 || event.button === 1))
          onSelect?.(node.id, event);
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${String(node.width)} ${String(node.height)}`}
        overflow="visible"
        focusable="false"
        aria-hidden="true"
      >
        {!preview && (
          <path
            d={path}
            fill="none"
            stroke="transparent"
            strokeWidth={Math.max(12, strokeWidth + 6)}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pointerEvents: "stroke" }}
          />
        )}
        <path
          data-testid="freehand-path"
          d={path}
          fill="none"
          stroke={freehandColor(node, theme)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={
            node.style.strokeDash === "dashed"
              ? "8 5"
              : node.style.strokeDash === "dotted"
                ? "1 5"
                : undefined
          }
          style={{ pointerEvents: preview ? "none" : "stroke" }}
        />
      </svg>
    </div>
  );
}
