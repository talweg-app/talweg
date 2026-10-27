import { GripHorizontal } from "lucide-react";
import type { CanvasDocument, CanvasNode, NodeId } from "@talweg/core";
import { groupBounds } from "../utils/organizeCanvas.js";
import { useTranslation } from "../hooks/useTranslation.js";

export function GroupRenderer({
  node,
  document,
  selected,
  onSelect,
  onRename,
}: {
  node: CanvasNode;
  document: CanvasDocument;
  selected: boolean;
  onSelect: (id: NodeId, event: React.PointerEvent) => void;
  onRename: (id: NodeId, title: string) => void;
}) {
  const { t } = useTranslation();
  const bounds = groupBounds(document, node);
  return (
    <div
      data-testid="canvas-group"
      data-node-id={node.id}
      role="group"
      aria-label={t("organize.group")}
      className="canvas-group"
      data-selected={selected}
      style={{
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        zIndex: node.zIndex,
        borderColor: selected ? "var(--accent)" : node.style.strokeColor,
        backgroundColor: node.style.fillColor,
      }}
    >
      <div className="canvas-group-heading">
        <button
          type="button"
          aria-label={t("organize.moveGroup")}
          title={t("organize.moveGroup")}
          onPointerDown={(event) => {
            onSelect(node.id, event);
          }}
        >
          <GripHorizontal size={16} />
        </button>
        <input
          data-presence-field="group-title"
          aria-label={t("organize.groupName")}
          placeholder={t("organize.group")}
          value={typeof node.meta?.title === "string" ? node.meta.title : ""}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onChange={(event) => {
            onRename(node.id, event.target.value);
          }}
        />
      </div>
    </div>
  );
}
