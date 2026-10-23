import { useMemo } from "react";
import type { ArrowNode, CanvasDocument, NodeId } from "@talweg/core";
import {
  type PortSlotMap,
  computeConnectorGeometry,
} from "../utils/connectorGeometry.js";

interface ConnectorRendererProps {
  arrow: ArrowNode;
  document: CanvasDocument;
  portSlots: PortSlotMap;
  isSelected: boolean;
  onSelect: (id: NodeId, e: React.PointerEvent) => void;
  onHoverArrow?: (id: NodeId | null) => void;
}

export function ConnectorRenderer({
  arrow,
  document,
  portSlots,
  isSelected,
  onSelect,
  onHoverArrow,
}: ConnectorRendererProps) {
  const renderedData = useMemo(() => {
    try {
      return computeConnectorGeometry(arrow, document, portSlots);
    } catch {
      return null;
    }
  }, [arrow, document, portSlots]);

  if (!renderedData) return null;

  const strokeColor = isSelected
    ? "#f59e0b"
    : arrow.data.curveStyle === "bezier"
      ? "#818cf8"
      : (arrow.style.strokeColor ?? "#64748b");
  const strokeWidth = isSelected ? 2 : (arrow.style.strokeWidth ?? 1.5);

  return (
    <g
      className="cursor-pointer group"
      onPointerDown={(e) => {
        e.stopPropagation();
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
      {renderedData.isBezier && (
        <circle
          cx={renderedData.targetPoint.x}
          cy={renderedData.targetPoint.y}
          r={3}
          fill={strokeColor}
          className="transition-colors pointer-events-none"
        />
      )}

      {/* Orthogonal Markers */}
      {renderedData.startMarkerSvg && (
        <path
          d={renderedData.startMarkerSvg}
          fill={strokeColor}
          className="transition-colors pointer-events-none"
        />
      )}

      {renderedData.endMarkerSvg && (
        <path
          d={renderedData.endMarkerSvg}
          fill={strokeColor}
          className="transition-colors pointer-events-none"
        />
      )}

      {/* Edge label */}
      {arrow.data.label && (
        <g
          transform={`translate(${String(renderedData.midpoint.x)}, ${String(renderedData.midpoint.y)})`}
          className="pointer-events-none select-none"
        >
          <rect
            x={-arrow.data.label.length * 3.5 - 6}
            y={-10}
            width={arrow.data.label.length * 7 + 12}
            height={18}
            rx={3}
            fill="#090a0f"
            stroke="#27272a"
            strokeWidth={1}
          />
          <text
            x={0}
            y={3}
            textAnchor="middle"
            fill="#a1a1aa"
            fontSize={10}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontWeight={500}
          >
            {arrow.data.label}
          </text>
        </g>
      )}
    </g>
  );
}
