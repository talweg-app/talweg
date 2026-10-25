import { Group, Ungroup } from "lucide-react";
import type { CanvasDocument, NodeId } from "@talweg/core";
import { selectionRoots, type Alignment } from "../utils/organizeCanvas.js";
import { useTranslation } from "../hooks/useTranslation.js";

export function OrganizeControls({
  document,
  selectedIds,
  onGroup,
  onUngroup,
  onAlign,
}: {
  document: CanvasDocument;
  selectedIds: ReadonlySet<NodeId>;
  onGroup: () => void;
  onUngroup: () => void;
  onAlign: (alignment: Alignment) => void;
}) {
  const { t } = useTranslation();
  const nodes = selectionRoots(document, selectedIds).filter(
    (node) => node.type !== "arrow",
  );
  if (!nodes.length) return null;
  const canGroup = nodes.length >= 2 && nodes.every((node) => !node.parentId);
  return (
    <div className="organize-controls" data-testid="organize-controls">
      <span>
        {nodes.length} {t("organize.selected")}
      </span>
      {canGroup && (
        <button type="button" onClick={onGroup} title={t("organize.groupHint")}>
          <Group size={15} />
          {t("organize.group")}
        </button>
      )}
      {nodes.some((node) => node.type === "group") && (
        <button type="button" onClick={onUngroup}>
          <Ungroup size={15} />
          {t("organize.ungroup")}
        </button>
      )}
      {nodes.length >= 2 && (
        <select
          aria-label={t("organize.align")}
          value=""
          onChange={(event) => {
            if (event.target.value) onAlign(event.target.value as Alignment);
          }}
        >
          <option value="" disabled>
            {t("organize.align")}
          </option>
          {(
            ["left", "center", "right", "top", "middle", "bottom"] as const
          ).map((alignment) => (
            <option key={alignment} value={alignment}>
              {t(`organize.${alignment}`)}
            </option>
          ))}
          {nodes.length >= 3 && (
            <>
              <option value="horizontal">{t("organize.horizontal")}</option>
              <option value="vertical">{t("organize.vertical")}</option>
            </>
          )}
        </select>
      )}
    </div>
  );
}
