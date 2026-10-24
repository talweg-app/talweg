import type { CanvasNode, NodeStyle } from "@talweg/core";
import { AlignCenter, AlignLeft, AlignRight, Check } from "lucide-react";
import { useTranslation } from "../hooks/useTranslation.js";

const SWATCHES = [
  "#eeeeeb",
  "#b4b7b4",
  "#727777",
  "#242729",
  "#101112",
  "#e9dda7",
  "#d5a17d",
  "#cb8584",
  "#b09acb",
  "#8caecc",
  "#83b7a3",
  "#a8b987",
];

interface NodeStylePanelProps {
  nodes: readonly CanvasNode[];
  onUpdateStyle: (style: NodeStyle) => void;
}

export function NodeStylePanel({ nodes, onUpdateStyle }: NodeStylePanelProps) {
  const { t } = useTranslation();
  const node = nodes[0];
  if (!node) return null;
  const style = node.style;
  const mixed = (key: keyof NodeStyle) =>
    nodes.some((candidate) => candidate.style[key] !== style[key]);
  const hasSurface = node.type !== "arrow" && node.type !== "image";
  const colorRow = (
    key: "fillColor" | "strokeColor" | "textColor",
    fallback: string,
  ) => (
    <div className="inspector-color-row">
      <div className="inspector-row">
        <span>{t(`inspector.${key}`)}</span>
        <label className="inspector-color-value">
          <input
            type="color"
            aria-label={t(`inspector.${key}`)}
            value={
              /^#[\da-f]{6}$/i.test(style[key] ?? "") ? style[key] : fallback
            }
            onChange={(e) => {
              onUpdateStyle({ [key]: e.target.value });
            }}
          />
          <span>
            {mixed(key)
              ? t("inspector.mixed")
              : style[key] === "transparent"
                ? t("inspector.none")
                : (style[key] ?? fallback).toUpperCase()}
          </span>
        </label>
      </div>
      <div
        className="inspector-swatches"
        role="group"
        aria-label={t(`inspector.${key}`)}
      >
        {SWATCHES.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            aria-label={`${t(`inspector.${key}`)} ${color}`}
            aria-pressed={!mixed(key) && style[key] === color}
            style={{ background: color }}
            onClick={() => {
              onUpdateStyle({ [key]: color });
            }}
          >
            {!mixed(key) && style[key] === color && (
              <Check
                size={12}
                color={
                  ["#eeeeeb", "#e9dda7", "#b4b7b4"].includes(color)
                    ? "#101112"
                    : "white"
                }
              />
            )}
          </button>
        ))}
        {key === "fillColor" && (
          <button
            type="button"
            className="transparent-swatch"
            title={t("inspector.none")}
            aria-label={t("inspector.noFill")}
            aria-pressed={style.fillColor === "transparent"}
            onClick={() => {
              onUpdateStyle({ fillColor: "transparent" });
            }}
          />
        )}
      </div>
    </div>
  );

  return (
    <div className="node-inspector">
      {hasSurface &&
        colorRow("fillColor", node.type === "sticker" ? "#e9dda7" : "#242729")}
      {colorRow("strokeColor", "#727777")}
      <div className="inspector-row">
        <span>{t("inspector.strokeWidth")}</span>
        <div
          className="inspector-segments"
          role="group"
          aria-label={t("inspector.strokeWidth")}
        >
          {[0, 1, 2, 3, 5].map((width) => (
            <button
              key={width}
              type="button"
              aria-pressed={
                !mixed("strokeWidth") && (style.strokeWidth ?? 1) === width
              }
              onClick={() => {
                onUpdateStyle({ strokeWidth: width });
              }}
            >
              {width === 0 ? "∅" : width}
            </button>
          ))}
        </div>
      </div>
      <div className="inspector-row">
        <span>{t("inspector.strokeDash")}</span>
        <div
          className="inspector-segments"
          role="group"
          aria-label={t("inspector.strokeDash")}
        >
          {(["solid", "dashed", "dotted"] as const).map((dash) => (
            <button
              key={dash}
              type="button"
              aria-label={t(`inspector.${dash}`)}
              title={t(`inspector.${dash}`)}
              aria-pressed={
                !mixed("strokeDash") && (style.strokeDash ?? "solid") === dash
              }
              onClick={() => {
                onUpdateStyle({ strokeDash: dash });
              }}
            >
              <svg width="24" height="12">
                <line
                  x1="2"
                  y1="6"
                  x2="22"
                  y2="6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray={
                    dash === "dashed"
                      ? "5 3"
                      : dash === "dotted"
                        ? "1 4"
                        : undefined
                  }
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ))}
        </div>
      </div>
      {hasSurface && (
        <>
          {colorRow(
            "textColor",
            node.type === "sticker" ? "#343024" : "#eeeeeb",
          )}
          <div className="inspector-row">
            <label htmlFor="node-font-size">{t("inspector.fontSize")}</label>
            <select
              id="node-font-size"
              value={style.fontSize ?? 14}
              onChange={(e) => {
                onUpdateStyle({ fontSize: Number(e.target.value) });
              }}
            >
              {[
                ...new Set([
                  12,
                  14,
                  16,
                  18,
                  20,
                  24,
                  32,
                  48,
                  style.fontSize ?? 14,
                ]),
              ]
                .sort((a, b) => a - b)
                .map((size) => (
                  <option key={size} value={size}>
                    {size} px
                  </option>
                ))}
            </select>
            <button
              type="button"
              className="inspector-bold"
              aria-label={t("inspector.bold")}
              aria-pressed={style.fontWeight === 700}
              onClick={() => {
                onUpdateStyle({
                  fontWeight: style.fontWeight === 700 ? 400 : 700,
                });
              }}
            >
              B
            </button>
            <div
              className="inspector-segments"
              role="group"
              aria-label={t("inspector.textAlign")}
            >
              {(["left", "center", "right"] as const).map((align, index) => {
                const Icon =
                  [AlignLeft, AlignCenter, AlignRight][index] ?? AlignLeft;
                return (
                  <button
                    key={align}
                    type="button"
                    aria-label={t(`inspector.${align}`)}
                    aria-pressed={
                      (style.textAlign ??
                        (node.type === "sticker" ||
                        node.type === "text" ||
                        node.type === "card" ||
                        node.type === "table" ||
                        node.type === "checklist"
                          ? "left"
                          : "center")) === align
                    }
                    onClick={() => {
                      onUpdateStyle({ textAlign: align });
                    }}
                  >
                    <Icon size={14} />
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
      {(node.type === "rectangle" ||
        node.type === "sticker" ||
        node.type === "card" ||
        node.type === "table" ||
        node.type === "checklist" ||
        node.type === "image") && (
        <div className="inspector-row">
          <label htmlFor="node-corner-radius">
            {t("inspector.cornerRadius")}
          </label>
          <input
            id="node-corner-radius"
            type="range"
            min="0"
            max="32"
            step="2"
            value={
              typeof style.cornerRadius === "number" ? style.cornerRadius : 6
            }
            onChange={(e) => {
              onUpdateStyle({ cornerRadius: Number(e.target.value) });
            }}
          />
          <span className="inspector-number">
            {typeof style.cornerRadius === "number" ? style.cornerRadius : 6}
          </span>
        </div>
      )}
    </div>
  );
}
