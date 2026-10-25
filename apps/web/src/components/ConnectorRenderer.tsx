import { useTheme } from "../hooks/useTheme.js";
import { connectorAppearance } from "../utils/sceneAppearance.js";
import { createPortal } from "react-dom";
import { useMemo } from "react";
import type { ArrowNode, CanvasDocument, NodeId } from "@talweg/core";
import {
  type PortSlotMap,
  computeConnectorGeometry,
} from "../utils/connectorGeometry.js";

interface ConnectorRendererProps {
  labelLayer: SVGSVGElement | null;
  arrow: ArrowNode;
  document: CanvasDocument;
  portSlots: PortSlotMap;
  isSelected: boolean;
  onSelect: (id: NodeId, e: React.PointerEvent) => void;
  onEditLabel: (id: NodeId, point: { x: number; y: number }) => void;
  onHoverArrow?: (id: NodeId | null) => void;
}

export function ConnectorRenderer({
  labelLayer,
  arrow,
  document,
  portSlots,
  isSelected,
  onSelect,
  onHoverArrow,
  onEditLabel,
}: ConnectorRendererProps) {
  const { theme } = useTheme();
  const renderedData = useMemo(() => {
    try {
      return computeConnectorGeometry(arrow, document, portSlots);
    } catch {
      return null;
    }
  }, [arrow, document, portSlots]);

  if (!renderedData) return null;

  const strokeColor = connectorAppearance(arrow.style.strokeColor ?? "#64748b", theme);
  const strokeWidth =
    arrow.style.strokeDash === "none" ? 0 : (arrow.style.strokeWidth ?? 1.5);

  return (
    <g
      data-node-id={arrow.id}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onEditLabel(arrow.id, { x: event.clientX, y: event.clientY });
      }}
      className="cursor-pointer group"
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.button !== 0) return;
        onSelect(arrow.id, e);
      }}
    >
      {/* Invisible wider hit-target stroke */}
      <path
        d={renderedData.lineSvgPath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        className="pointer-events-auto"
        onPointerEnter={() => {
          onHoverArrow?.(arrow.id);
        }}
        onPointerLeave={() => {
          onHoverArrow?.(null);
        }}
      />

      {isSelected && (
        <path
          d={renderedData.lineSvgPath}
          fill="none"
          stroke="#e9dda7"
          strokeOpacity={0.25}
          strokeWidth={strokeWidth + 6}
          className="pointer-events-none"
        />
      )}

      {/* Main vector line */}
      <path
        d={renderedData.lineSvgPath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={
          arrow.style.strokeDash === "dashed"
            ? "6,6"
            : arrow.style.strokeDash === "dotted"
              ? "2,4"
              : undefined
        }
        className="transition-colors pointer-events-none"
      />

      {/* End dot for Bezier branch connections */}
      {strokeWidth > 0 && renderedData.isBezier && (
        <circle
          cx={renderedData.targetPoint.x}
          cy={renderedData.targetPoint.y}
          r={3}
          fill={strokeColor}
          className="transition-colors pointer-events-none"
        />
      )}

      {/* Orthogonal Markers */}
      {strokeWidth > 0 && renderedData.startMarkerSvg && (
        <path
          d={renderedData.startMarkerSvg}
          fill={strokeColor}
          className="transition-colors pointer-events-none"
        />
      )}

      {strokeWidth > 0 && renderedData.endMarkerSvg && (
        <path
          d={renderedData.endMarkerSvg}
          fill={strokeColor}
          className="transition-colors pointer-events-none"
        />
      )}

      {/* Edge label */}
      {arrow.data.label &&
        renderedData.labelAnchor &&
        Math.hypot(
          renderedData.midpoint.x - renderedData.labelAnchor.x,
          renderedData.midpoint.y - renderedData.labelAnchor.y,
        ) > 1 && (
          <line
            x1={renderedData.labelAnchor.x}
            y1={renderedData.labelAnchor.y}
            x2={renderedData.midpoint.x}
            y2={renderedData.midpoint.y}
            stroke={strokeColor}
            strokeWidth={0.75}
            strokeDasharray="3 3"
            opacity={0.5}
            className="pointer-events-none"
          />
        )}
      {arrow.data.label &&
        labelLayer &&
        createPortal(
          <g
            transform={`translate(${String(renderedData.midpoint.x)}, ${String(renderedData.midpoint.y)})`}
            data-testid="connector-label"
            data-node-id={arrow.id}
            className="pointer-events-auto cursor-pointer select-none"
            onDoubleClick={(event) => {
              event.stopPropagation();
              onEditLabel(arrow.id, { x: event.clientX, y: event.clientY });
            }}
          >
            <rect
              x={-arrow.data.label.length * 3.5 - 6}
              y={-10}
              width={arrow.data.label.length * 7 + 12}
              height={18}
              rx={3}
              fill="var(--canvas-label-bg)"
              stroke="var(--canvas-label-border)"
              strokeWidth={1}
            />
            <text
              x={0}
              y={3}
              textAnchor="middle"
              fill={arrow.style.textColor ?? "var(--canvas-label-ink)"}
              fontSize={10}
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fontWeight={500}
            >
              {arrow.data.label}
            </text>
          </g>,
          labelLayer,
        )}
    </g>
  );
}
