import { ChoicePicker } from "./ChoicePicker.js";
import { Group, Ungroup, AlignVerticalSpaceAround } from "lucide-react";
import type { CanvasDocument, NodeId } from "@talweg/core";
import { selectionRoots, type Alignment } from "../utils/organizeCanvas.js";
import { useTranslation } from "../hooks/useTranslation.js";

export function OrganizeControls({
  document,
  selectedIds,
  onGroup,
  onUngroup,
  onAlign,
  onPreviewAlign,
}: {
  document: CanvasDocument;
  selectedIds: ReadonlySet<NodeId>;
  onGroup: () => void;
  onUngroup: () => void;
  onAlign: (alignment: Alignment) => void;
  onPreviewAlign?: (alignment: Alignment | null) => void;
}) {
  const { t } = useTranslation();
  const nodes = selectionRoots(document, selectedIds).filter(
    (node) => node.type !== "arrow",
  );
  if (!nodes.length || (nodes.length === 1 && nodes[0]?.type !== "group"))
    return null;
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
        <button
          type="button"
          title={t("organize.tidyHint")}
          onPointerMove={() => onPreviewAlign?.("tidy")}
          onPointerLeave={() => onPreviewAlign?.(null)}
          onFocus={() => onPreviewAlign?.("tidy")}
          onBlur={() => onPreviewAlign?.(null)}
          onClick={() => {
            onPreviewAlign?.(null);
            onAlign("tidy");
          }}
        >
          <AlignVerticalSpaceAround size={15} />
          {t("organize.tidy")}
        </button>
      )}
      {nodes.length >= 2 && (
        <ChoicePicker className="organize-picker" label={t("organize.align")} value=""
          options={[{ value: "", label: t("organize.align"), disabled: true }, ...(["left", "center", "right", "top", "middle", "bottom", ...(nodes.length >= 3 ? ["horizontal", "vertical"] : [])]).map(alignment => ({ value: alignment, label: t(`organize.${alignment}`) }))]}
          onChange={value => { onAlign(value as Alignment); }} />
      )}
    </div>
  );
}
