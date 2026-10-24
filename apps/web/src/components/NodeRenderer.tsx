import { useEffect, useState, type CSSProperties } from "react";
import type {
  CanvasNode,
  CapsuleNode,
  CardNode,
  CardStatus,
  CompassAnchor,
  CylinderNode,
  DiamondNode,
  ImageNode,
  NodeId,
  RectangleNode,
  EllipseNode,
  StickerNode,
  TextNode,
} from "@talweg/core";
import type { StorageAdapter } from "@talweg/storage";
import { CheckCircle2, Circle, Clock, Flame } from "lucide-react";
import { useTranslation } from "../hooks/useTranslation.js";
import type { CanvasMode } from "../types.js";
import { getCachedAssetUrl, resolveAssetUrl } from "../utils/assets.js";
import { StructuredNodeContent } from "./StructuredNodeContent.js";

interface NodeRendererProps {
  node: CanvasNode;
  isSelected: boolean;
  mode: CanvasMode;
  isPanActive?: boolean;
  adapter?: StorageAdapter | null | undefined;
  onSelect: (id: NodeId, e: React.PointerEvent) => void;
  onUpdateData: (id: NodeId, data: Record<string, unknown>) => void;
  onStartConnect?: (sourceId: NodeId, anchor?: CompassAnchor) => void;
}

const CARD_STATUS_CYCLE: CardStatus[] = ["todo", "in_progress", "done", "blocked"];

const PORT_TITLE: Record<CompassAnchor, string> = {
  n: "Connect North (N)",
  s: "Connect South (S)",
  w: "Connect West (W)",
  e: "Connect East (E)",
};

const PORT_POSITION: Record<CompassAnchor, string> = {
  n: "-top-1.5 left-1/2 -translate-x-1/2",
  s: "-bottom-1.5 left-1/2 -translate-x-1/2",
  w: "-left-1.5 top-1/2 -translate-y-1/2",
  e: "-right-1.5 top-1/2 -translate-y-1/2",
};

export function NodeRenderer({
  node,
  isSelected,
  isPanActive,
  adapter,
  onSelect,
  onUpdateData,
  onStartConnect,
}: NodeRendererProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);

  if (node.type === "arrow" || node.type === "group") {
    return null;
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    if (e.target instanceof Element && e.target.closest("input, textarea, button") && isSelected) { e.stopPropagation(); return; }
    onSelect(node.id, e);
  };

  const handleCycleStatus = (e: React.MouseEvent, currentStatus?: CardStatus) => {
    e.stopPropagation();
    const currentIndex = CARD_STATUS_CYCLE.indexOf(currentStatus ?? "todo");
    const nextStatus = CARD_STATUS_CYCLE[(currentIndex + 1) % CARD_STATUS_CYCLE.length] ?? "todo";
    onUpdateData(node.id, { status: nextStatus });
  };

  const selectionRing = isSelected
    ? "ring-1 ring-amber-500/80 shadow-lg shadow-black/40"
    : "hover:ring-1 hover:ring-white/20";

  const cursorClass = isPanActive ? "cursor-inherit" : "cursor-move";

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
      className={`absolute pointer-events-auto ${cursorClass} select-none transition-shadow ${selectionRing}`}
      onPointerDown={handlePointerDown}
      onDoubleClick={() => {
        setIsEditing(true);
      }}
    >
      {/* Compass Snap Ports (N, S, E, W) */}
      {isSelected && onStartConnect && (
        <>
          {(["n", "s", "w", "e"] as const).map((anchor) => (
            <button
              key={anchor}
              type="button"
              className={`absolute w-3 h-3 rounded-full bg-[#0b0c0e] border border-amber-400/90 hover:scale-125 transition cursor-crosshair z-30 ${PORT_POSITION[anchor]}`}
              title={PORT_TITLE[anchor]}
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                onStartConnect(node.id, anchor);
              }}
            />
          ))}
        </>
      )}

      {(node.type === "checklist" || node.type === "table") && (
        <StructuredNodeContent node={node} onUpdateData={onUpdateData} surfaceStyle={nodeSurface(node)} textStyle={nodeTypography(node)} />
      )}

      {/* Node Renderers */}
      {(node.type === "rectangle" || node.type === "ellipse") && (
        <RectangleContent
          node={node}
          isEditing={isEditing}
          onStopEditing={() => {
            setIsEditing(false);
          }}
          onUpdateData={onUpdateData}
        />
      )}

      {node.type === "sticker" && (
        <StickerContent
          node={node}
          onUpdateData={onUpdateData}
        />
      )}

      {node.type === "card" && (
        <CardContent
          node={node}
          t={t}
          onCycleStatus={handleCycleStatus}
          onUpdateData={onUpdateData}
        />
      )}

      {node.type === "diamond" && (
        <DiamondContent
          node={node}
          isEditing={isEditing}
          onStopEditing={() => {
            setIsEditing(false);
          }}
          onUpdateData={onUpdateData}
        />
      )}

      {node.type === "capsule" && (
        <CapsuleContent
          node={node}
          isEditing={isEditing}
          onStopEditing={() => {
            setIsEditing(false);
          }}
          onUpdateData={onUpdateData}
        />
      )}

      {node.type === "cylinder" && (
        <CylinderContent
          node={node}
          isEditing={isEditing}
          onStopEditing={() => {
            setIsEditing(false);
          }}
          onUpdateData={onUpdateData}
        />
      )}

      {node.type === "text" && (
        <TextContent
          node={node}
          isEditing={isEditing}
          onStopEditing={() => {
            setIsEditing(false);
          }}
          onUpdateData={onUpdateData}
        />
      )}

      {node.type === "image" && (
        <ImageContent
          node={node}
          adapter={adapter}
        />
      )}
    </div>
  );
}

function RectangleContent({
  node,
  isEditing,
  onStopEditing,
  onUpdateData,
}: {
  node: RectangleNode | EllipseNode;
  isEditing: boolean;
  onStopEditing: () => void;
  onUpdateData: (id: NodeId, data: Record<string, unknown>) => void;
}) {
  const cornerRadius =
    typeof node.style.cornerRadius === "number" ? node.style.cornerRadius : 6;

  return (
    <div
      data-testid="node-surface"
      style={{
        backgroundColor: node.style.fillColor ?? "#0f141c",
        borderColor: node.style.strokeColor ?? "#27272a",
        borderWidth: node.style.strokeDash === "none" ? 0 : (node.style.strokeWidth ?? 1),
        borderRadius: node.type === "ellipse" ? "50%" : cornerRadius,
        borderStyle: node.style.strokeDash === "dashed" ? "dashed" : node.style.strokeDash === "dotted" ? "dotted" : "solid",
        color: node.style.textColor ?? "#f4f4f5",
        ...nodeTypography(node),
      }}
      className="w-full h-full flex items-center justify-center p-3 text-center transition-colors shadow-sm"
    >
      {isEditing ? (
        <input
          type="text"
          autoFocus
          defaultValue={node.data?.label ?? ""}
          onBlur={(e) => {
            onUpdateData(node.id, { label: e.target.value });
            onStopEditing();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onUpdateData(node.id, { label: e.currentTarget.value });
              onStopEditing();
            }
          }}
          className="w-full bg-transparent text-center font-medium outline-none border-b border-amber-400/80 text-white"
          style={nodeTypography(node)}
        />
      ) : (
        <span
          className="font-medium select-none whitespace-pre-line leading-relaxed"
          style={nodeTypography(node)}
        >
          {node.data?.label ?? "Process"}
        </span>
      )}
    </div>
  );
}

function StickerContent({
  node,
  onUpdateData,
}: {
  node: StickerNode;
  onUpdateData: (id: NodeId, data: Record<string, unknown>) => void;
}) {
  return (
    <div
      style={{
        backgroundColor: node.style.fillColor ?? "#fef9c3",
        color: node.style.textColor ?? "#422006",
        ...nodeSurface(node),
        ...nodeTypography(node),
      }}
      className="w-full h-full p-3.5 shadow-sm border border-black/10 flex flex-col justify-between relative group"
    >
      <textarea
        value={node.data.content}
        onChange={(e) => {
          onUpdateData(node.id, { content: e.target.value });
        }}
        placeholder="Type a note..."
        className="w-full h-full bg-transparent resize-none outline-none font-sans leading-relaxed"
        style={nodeTypography(node)}
      />
    </div>
  );
}

function CardContent({
  node,
  t,
  onCycleStatus,
  onUpdateData,
}: {
  node: CardNode;
  t: (key: string) => string;
  onCycleStatus: (e: React.MouseEvent, status?: CardStatus) => void;
  onUpdateData: (id: NodeId, data: Record<string, unknown>) => void;
}) {
  const status = node.data.status ?? "todo";

  const defaultStatusConfig = {
    label: t("statuses.todo"),
    bg: "bg-neutral-800 border-neutral-700 text-neutral-300",
    icon: Circle,
  };

  const statusConfigs: Record<string, { label: string; bg: string; icon: typeof Circle }> = {
    todo: defaultStatusConfig,
    in_progress: {
      label: t("statuses.in_progress"),
      bg: "bg-amber-500/10 border-amber-500/30 text-amber-400",
      icon: Clock,
    },
    done: {
      label: t("statuses.done"),
      bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
      icon: CheckCircle2,
    },
    blocked: {
      label: t("statuses.blocked"),
      bg: "bg-rose-500/10 border-rose-500/30 text-rose-400",
      icon: Flame,
    },
  };

  const statusConfig = statusConfigs[status] ?? defaultStatusConfig;
  const StatusIcon = statusConfig.icon;

  return (
    <div style={{ ...nodeSurface(node), ...nodeTypography(node) }} className="w-full h-full p-3 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <input
            type="text"
            value={node.data.title}
            onChange={(e) => {
              onUpdateData(node.id, { title: e.target.value });
            }}
            placeholder="Card title..."
            className="w-full bg-transparent font-medium text-neutral-200 outline-none hover:bg-white/[0.04] focus:bg-white/[0.08] px-1 py-0.5 rounded transition"
            style={nodeTypography(node)}
          />

          <button
            type="button"
            onClick={(e) => {
              onCycleStatus(e, node.data.status);
            }}
            className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono border transition cursor-pointer shrink-0 ${statusConfig.bg}`}
            title="Click to toggle status"
          >
            <StatusIcon className="w-2.5 h-2.5" />
            <span>{statusConfig.label}</span>
          </button>
        </div>

        <textarea
          value={node.data.description ?? ""}
          onChange={(e) => {
            onUpdateData(node.id, { description: e.target.value });
          }}
          placeholder="Add description..."
          style={nodeTypography(node)}
          rows={3}
          className="w-full bg-transparent text-[11px] text-neutral-400 resize-none outline-none hover:bg-white/[0.03] focus:bg-white/[0.06] p-1 rounded transition leading-relaxed"
        />
      </div>

      {node.data.tags && node.data.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-neutral-800/80">
          {node.data.tags.map((tag) => (
            <span
              key={tag.id}
              style={{ color: tag.color }}
              className="px-1.5 py-0.2 rounded bg-neutral-800 text-[9px] font-mono border border-neutral-700/60"
            >
              {tag.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DiamondContent({
  node,
  isEditing,
  onStopEditing,
  onUpdateData,
}: {
  node: DiamondNode;
  isEditing: boolean;
  onStopEditing: () => void;
  onUpdateData: (id: NodeId, data: Record<string, unknown>) => void;
}) {
  const fillColor = node.style.fillColor ?? "#0f172a";
  const strokeColor = node.style.strokeColor ?? "#38bdf8";
  const strokeWidth = node.style.strokeWidth ?? 1.5;

  return (
    <div className="w-full h-full relative flex items-center justify-center">
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon
          points="50,2 98,50 50,98 2,50"
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={node.style.strokeDash === "none" ? 0 : strokeWidth}
          strokeDasharray={node.style.strokeDash === "dashed" ? "8 5" : node.style.strokeDash === "dotted" ? "2 4" : undefined}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="relative z-10 px-4 text-center w-full">
        {isEditing ? (
          <input
            autoFocus
            style={nodeTypography(node)}
            type="text"
            defaultValue={node.data?.label ?? "Decision"}
            onBlur={(e) => {
              onUpdateData(node.id, { label: e.target.value });
              onStopEditing();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onUpdateData(node.id, { label: e.currentTarget.value });
                onStopEditing();
              }
            }}
            className="w-full bg-transparent text-center font-medium text-[13px] outline-none border-b border-amber-400/80 text-white"
          />
        ) : (
          <span
            className="block font-medium text-[13px] select-none text-neutral-100 whitespace-pre-line leading-relaxed"
            style={nodeTypography(node)}
          >
            {node.data?.label ?? "Decision"}
          </span>
        )}
      </div>
    </div>
  );
}

function CapsuleContent({
  node,
  isEditing,
  onStopEditing,
  onUpdateData,
}: {
  node: CapsuleNode;
  isEditing: boolean;
  onStopEditing: () => void;
  onUpdateData: (id: NodeId, data: Record<string, unknown>) => void;
}) {
  const fillColor = node.style.fillColor ?? "#062b1e";
  const strokeColor = node.style.strokeColor ?? "#10b981";
  const strokeWidth = node.style.strokeWidth ?? 1.5;

  return (
    <div
      style={{
        backgroundColor: fillColor,
        borderColor: strokeColor,
        borderWidth: node.style.strokeDash === "none" ? 0 : strokeWidth,
        borderStyle: node.style.strokeDash === "dashed" ? "dashed" : node.style.strokeDash === "dotted" ? "dotted" : "solid",
        ...nodeTypography(node),
      }}
      className="w-full h-full rounded-full flex items-center justify-center p-3 text-center border shadow-sm transition-colors"
    >
      {isEditing ? (
        <input
          autoFocus
          style={nodeTypography(node)}
          type="text"
          defaultValue={node.data?.label ?? "Start / End"}
          onBlur={(e) => {
            onUpdateData(node.id, { label: e.target.value });
            onStopEditing();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onUpdateData(node.id, { label: e.currentTarget.value });
              onStopEditing();
            }
          }}
          className="w-full bg-transparent text-center font-medium text-[13px] outline-none border-b border-amber-400/80 text-white"
        />
      ) : (
        <span
          className="block font-medium text-[13px] select-none text-neutral-100 whitespace-pre-line leading-relaxed"
          style={nodeTypography(node)}
        >
          {node.data?.label ?? "Start / End"}
        </span>
      )}
    </div>
  );
}

function CylinderContent({
  node,
  isEditing,
  onStopEditing,
  onUpdateData,
}: {
  node: CylinderNode;
  isEditing: boolean;
  onStopEditing: () => void;
  onUpdateData: (id: NodeId, data: Record<string, unknown>) => void;
}) {
  const fillColor = node.style.fillColor ?? "#181126";
  const strokeColor = node.style.strokeColor ?? "#a855f7";
  const strokeWidth = node.style.strokeWidth ?? 1.5;

  return (
    <div className="w-full h-full relative flex items-center justify-center">
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Lower body */}
        <path
          d="M 2 20 L 2 80 A 48 18 0 0 0 98 80 L 98 20 Z"
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={node.style.strokeDash === "none" ? 0 : strokeWidth}
          strokeDasharray={node.style.strokeDash === "dashed" ? "8 5" : node.style.strokeDash === "dotted" ? "2 4" : undefined}
          vectorEffect="non-scaling-stroke"
        />
        {/* Top ellipse */}
        <ellipse
          cx="50"
          cy="20"
          rx="48"
          ry="18"
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={node.style.strokeDash === "none" ? 0 : strokeWidth}
          strokeDasharray={node.style.strokeDash === "dashed" ? "8 5" : node.style.strokeDash === "dotted" ? "2 4" : undefined}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="relative z-10 px-3 pt-4 text-center w-full">
        {isEditing ? (
          <input
            autoFocus
            style={nodeTypography(node)}
            type="text"
            defaultValue={node.data?.label ?? "Data"}
            onBlur={(e) => {
              onUpdateData(node.id, { label: e.target.value });
              onStopEditing();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onUpdateData(node.id, { label: e.currentTarget.value });
                onStopEditing();
              }
            }}
            className="w-full bg-transparent text-center font-medium text-[13px] outline-none border-b border-amber-400/80 text-white"
          />
        ) : (
          <span
            className="block font-medium text-[13px] select-none text-neutral-100 whitespace-pre-line leading-relaxed"
            style={nodeTypography(node)}
          >
            {node.data?.label ?? "Data"}
          </span>
        )}
      </div>
    </div>
  );
}

function TextContent({
  node,
  isEditing,
  onStopEditing,
  onUpdateData,
}: {
  node: TextNode;
  isEditing: boolean;
  onStopEditing: () => void;
  onUpdateData: (id: NodeId, data: Record<string, unknown>) => void;
}) {
  return (
    <div style={{ ...nodeSurface(node), ...nodeTypography(node) }} className="w-full h-full flex items-center p-2">
      {isEditing ? (
        <textarea
          autoFocus
          style={nodeTypography(node)}
          defaultValue={node.data.text}
          onBlur={(e) => {
            onUpdateData(node.id, { text: e.target.value });
            onStopEditing();
          }}
          className="w-full h-full bg-transparent font-medium text-neutral-100 outline-none resize-none font-sans"
        />
      ) : (
        <div
          className="font-medium text-neutral-100 whitespace-pre-wrap select-none leading-relaxed"
          style={nodeTypography(node)}
        >
          {node.data.text || "Text"}
        </div>
      )}
    </div>
  );
}

function ImageContent({
  node,
  adapter,
}: {
  node: ImageNode;
  adapter?: StorageAdapter | null | undefined;
}) {
  const [url, setUrl] = useState<string | null>(() => getCachedAssetUrl(node.data.assetId) ?? null);

  useEffect(() => {
    if (!url) {
      let isMounted = true;
      void resolveAssetUrl(node.data.assetId, adapter).then((resolved) => {
        if (isMounted && resolved) {
          setUrl(resolved);
        }
      });
      return () => {
        isMounted = false;
      };
    }
  }, [node.data.assetId, adapter, url]);

  const cornerRadius = typeof node.style.cornerRadius === "number" ? node.style.cornerRadius : 6;

  return (
    <div
      className="w-full h-full overflow-hidden flex items-center justify-center bg-neutral-900/60 select-none shadow-md border border-white/10"
      style={{ ...nodeSurface(node), borderRadius: cornerRadius }}
    >
      {url ? (
        <img
          src={url}
          alt={node.data.altText ?? "Canvas image"}
          className="w-full h-full object-contain pointer-events-none select-none"
          style={{ ...nodeSurface(node), borderRadius: cornerRadius }}
          draggable={false}
        />
      ) : (
        <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
      )}
    </div>
  );
}

function nodeTypography(node: CanvasNode): CSSProperties {
  return {
    color: node.style.textColor ?? (node.type === "sticker" ? "#422006" : "#eeeeeb"),
    fontSize: node.style.fontSize ?? 14,
    fontWeight: node.style.fontWeight ?? 400,
    fontFamily: node.style.fontFamily,
    textAlign: node.style.textAlign ?? (node.type === "rectangle" || node.type === "ellipse" || node.type === "diamond" || node.type === "capsule" || node.type === "cylinder" ? "center" : "left"),
    width: "100%",
  };
}

function nodeSurface(node: CanvasNode): CSSProperties {
  return {
    backgroundColor: node.style.fillColor ?? (node.type === "sticker" ? "#fef9c3" : "#242729"),
    borderColor: node.style.strokeColor ?? "#727777",
    borderWidth: node.style.strokeDash === "none" ? 0 : (node.style.strokeWidth ?? 1),
    borderStyle: node.style.strokeDash === "dashed" ? "dashed" : node.style.strokeDash === "dotted" ? "dotted" : "solid",
    borderRadius: typeof node.style.cornerRadius === "number" ? node.style.cornerRadius : 6,
  };
}
