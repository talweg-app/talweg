import { lazy, Suspense, useCallback, useEffect, useState, type CSSProperties } from "react";
import type {
  CanvasNode,
  CardStatus,
  CompassAnchor,
  NodeId,
  TextRun,
} from "@talweg/core";
import type { StorageAdapter } from "@talweg/storage";
import { CheckCircle2, Circle, Clock, FileText, Flame } from "lucide-react";
import { useTranslation } from "../hooks/useTranslation.js";
import { StructuredNodeContent } from "./StructuredNodeContent.js";
import { RichText } from "./RichText.js";
import { AssetImage } from "./AssetImage.js";
const NoteEditor = lazy(async () => { const module = await import("./NoteEditor.js"); return { default: module.NoteEditor }; });

interface NodeRendererProps {
  node: CanvasNode;
  isSelected: boolean;
  isPanActive?: boolean;
  adapter?: StorageAdapter | null | undefined;
  onSelect: (id: NodeId, event: React.PointerEvent) => void;
  onUpdateData: (id: NodeId, data: Record<string, unknown>) => void;
  onUpdateRuns: (id: NodeId, field: string, runs: TextRun[]) => void;
  onUpdateNote: (id: NodeId, note: string) => void;
  onStartConnect?: (sourceId: NodeId, anchor?: CompassAnchor) => void;
}

const PORT_POSITION: Record<CompassAnchor, string> = {
  n: "-top-1.5 left-1/2 -translate-x-1/2",
  s: "-bottom-1.5 left-1/2 -translate-x-1/2",
  w: "-left-1.5 top-1/2 -translate-y-1/2",
  e: "-right-1.5 top-1/2 -translate-y-1/2",
};
const CARD_STATUS: CardStatus[] = ["todo", "in_progress", "done", "blocked"];

export function NodeRenderer({
  node,
  isSelected,
  isPanActive,
  adapter,
  onSelect,
  onUpdateData,
  onUpdateRuns,
  onUpdateNote,
  onStartConnect,
}: NodeRendererProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  useEffect(() => {
    if (!isSelected) return;
    const openNote = (event: Event) => {
      if (event instanceof CustomEvent && event.detail === node.id) setNoteOpen(true);
    };
    window.addEventListener("talweg:edit-note", openNote);
    return () => { window.removeEventListener("talweg:edit-note", openNote); };
  }, [isSelected, node.id]);
  const closeNote = useCallback(() => {
    setNoteOpen(false);
  }, []);
  if (node.type === "arrow" || node.type === "group") return null;
  const typography: CSSProperties = {
    color:
      node.style.textColor ?? (node.type === "sticker" ? "#422006" : "#eeeeeb"),
    fontSize: node.style.fontSize ?? 14,
    fontWeight: node.style.fontWeight ?? 400,
    fontFamily: node.style.fontFamily,
    textAlign:
      node.style.textAlign ??
      (["rectangle", "ellipse", "diamond", "capsule", "cylinder"].includes(
        node.type,
      )
        ? "center"
        : "left"),
  };
  const surface: CSSProperties = {
    backgroundColor:
      node.style.fillColor ?? (node.type === "sticker" ? "#fef9c3" : "#242729"),
    borderColor: node.style.strokeColor ?? "#727777",
    borderWidth:
      node.style.strokeDash === "none" ? 0 : (node.style.strokeWidth ?? 1),
    borderStyle:
      node.style.strokeDash === "dashed"
        ? "dashed"
        : node.style.strokeDash === "dotted"
          ? "dotted"
          : "solid",
    borderRadius:
      typeof node.style.cornerRadius === "number" ? node.style.cornerRadius : 6,
  };
  const rich = (
    field: string,
    text: string,
    label: string,
    editing = true,
    multiline = true,
  ) => (
    <RichText
      text={text}
      runs={node.textRuns?.[field]}
      label={label}
      placeholder={label}
      editing={editing}
      multiline={multiline}
      autoFocus={isEditing}
      style={typography}
      onBlur={() => {
        setIsEditing(false);
      }}
      onCommit={(nextText, runs) => {
        onUpdateData(node.id, { [field]: nextText });
        onUpdateRuns(node.id, field, runs);
      }}
    />
  );
  const isShape =
    node.type === "rectangle" ||
    node.type === "ellipse" ||
    node.type === "diamond" ||
    node.type === "capsule" ||
    node.type === "cylinder";
  const strokeDasharray =
    node.style.strokeDash === "dashed"
      ? "8 5"
      : node.style.strokeDash === "dotted"
        ? "2 4"
        : undefined;
  const svgStyle = {
    fill: node.style.fillColor ?? "#242729",
    stroke: node.style.strokeColor ?? "#727777",
    strokeWidth:
      node.style.strokeDash === "none" ? 0 : (node.style.strokeWidth ?? 1),
    strokeDasharray,
    vectorEffect: "non-scaling-stroke",
  };

  return (
    <div
      data-testid="canvas-node"
      role="group"
      aria-label={t(`tools.${node.type}`)}
      data-node-id={node.id}
      style={{
        transform: `translate3d(${String(node.x)}px, ${String(node.y)}px, 0px) rotate(${String(node.rotation)}deg)`,
        width: node.width,
        height: node.height,
        zIndex: node.zIndex,
        opacity: node.opacity,
      }}
      className={`absolute pointer-events-auto select-none ${isPanActive ? "cursor-inherit" : "cursor-move"} ${isSelected ? "ring-1 ring-amber-500/80" : "hover:ring-1 hover:ring-white/20"}`}
      onPointerDown={(event) => {
        if (event.button !== 0 && event.button !== 1) return;
        if (
          !isPanActive &&
          event.button === 0 &&
          event.target instanceof Element &&
          event.target.closest(
            'input, textarea, button, [contenteditable="true"]',
          ) &&
          isSelected
        ) {
          event.stopPropagation();
          return;
        }
        onSelect(node.id, event);
      }}
      onDoubleClick={(event) => {
        if (event.target instanceof Element && !event.target.closest("button"))
          setIsEditing(true);
      }}
    >
      {isSelected &&
        onStartConnect &&
        (["n", "s", "w", "e"] as const).map((anchor) => (
          <button
            key={anchor}
            type="button"
            className={`absolute w-3 h-3 rounded-full bg-[#161819] border border-[#e9dda7] cursor-crosshair z-30 ${PORT_POSITION[anchor]}`}
            title={`Connect ${anchor.toUpperCase()}`}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={() => {
              onStartConnect(node.id, anchor);
            }}
          />
        ))}
      {(typeof node.note === "string" || node.type === "markdown") && (
        <button
          type="button"
          className={`node-note-trigger ${node.type === "markdown" ? "node-note-main" : ""}`}
          aria-label={t("note.open")}
          title={t("note.open")}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={() => {
            setNoteOpen(true);
          }}
        >
          <FileText size={node.type === "markdown" ? 24 : 13} />
        </button>
      )}
      {isShape && (
        <div
          data-testid="node-surface"
          className="node-shape"
          style={{
            ...typography,
            ...(node.type === "diamond" || node.type === "cylinder"
              ? {}
              : surface),
            borderRadius:
              node.type === "capsule"
                ? 9999
                : node.type === "ellipse"
                  ? "50%"
                  : surface.borderRadius,
          }}
        >
          {(node.type === "diamond" || node.type === "cylinder") && (
            <svg
              className="node-vector"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {node.type === "diamond" ? (
                <polygon points="50,2 98,50 50,98 2,50" {...svgStyle} />
              ) : (
                <>
                  <path
                    d="M 2 20 L 2 80 A 48 18 0 0 0 98 80 L 98 20 Z"
                    {...svgStyle}
                  />
                  <ellipse cx="50" cy="20" rx="48" ry="18" {...svgStyle} />
                </>
              )}
            </svg>
          )}
          <div
            className="node-shape-label"
            style={{ paddingTop: node.type === "cylinder" ? 16 : 0 }}
          >
            {rich(
              "label",
              node.data?.label ?? "",
              t("richText.label"),
              isEditing,
              false,
            )}
          </div>
        </div>
      )}
      {node.type === "sticker" && (
        <div className="node-sticker" style={{ ...surface, ...typography }}>
          {rich("content", node.data.content, t("tools.sticker"))}
        </div>
      )}
      {node.type === "text" && (
        <div className="node-text" style={{ ...surface, ...typography }}>
          {rich("text", node.data.text, t("tools.text"), isEditing)}
        </div>
      )}
      {node.type === "card" && (
        <div className="node-card" style={{ ...surface, ...typography }}>
          <div className="node-card-title">
            {rich(
              "title",
              node.data.title,
              t("richText.cardTitle"),
              true,
              false,
            )}
          </div>
          <button
            type="button"
            className="card-status"
            onClick={() => {
              const status =
                CARD_STATUS[
                  (CARD_STATUS.indexOf(node.data.status ?? "todo") + 1) %
                    CARD_STATUS.length
                ] ?? "todo";
              onUpdateData(node.id, { status });
            }}
          >
            {node.data.status === "done" ? (
              <CheckCircle2 size={13} />
            ) : node.data.status === "in_progress" ? (
              <Clock size={13} />
            ) : node.data.status === "blocked" ? (
              <Flame size={13} />
            ) : (
              <Circle size={13} />
            )}
            {t(`statuses.${node.data.status ?? "todo"}`)}
          </button>
          {rich(
            "description",
            node.data.description ?? "",
            t("richText.description"),
          )}
        </div>
      )}
      {(node.type === "table" || node.type === "checklist") && (
        <StructuredNodeContent
          node={node}
          onUpdateData={onUpdateData}
          onUpdateRuns={onUpdateRuns}
          surfaceStyle={surface}
          textStyle={typography}
        />
      )}
      {node.type === "markdown" && (
        <div className="markdown-node" style={{ ...surface, ...typography }}>
          <strong>{node.data.title || t("note.untitled")}</strong>
          <span>
            {(node.note ?? "").replace(/[#*`]/g, "").slice(0, 90) ||
              t("note.nodeHint")}
          </span>
        </div>
      )}
      {node.type === "image" && (
        <div className="node-image" style={surface}>
          <AssetImage
            assetId={node.data.assetId}
            alt={node.data.altText ?? t("tools.image")}
            adapter={adapter}
          />
        </div>
      )}
      {noteOpen && (
        <Suspense fallback={null}><NoteEditor
          node={node}
          adapter={adapter}
          onChange={(markdown) => {
            onUpdateNote(node.id, markdown);
            if (node.type === "markdown")
              onUpdateData(node.id, {
                title: /^#\s+(.+)$/m.exec(markdown)?.[1] ?? "",
              });
          }}
          onClose={closeNote}
        /></Suspense>
      )}
    </div>
  );
}
