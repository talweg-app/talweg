import type { NodeStyle } from "@talweg/core";
import type { Theme } from "../themeContext.js";
import { ensureTextContrast } from "./colorContrast.js";

const lightPalette: Record<string, { fill: string; stroke: string; text: string }> = {
  "#38bdf8": { fill: "#f0f7fa", stroke: "#59869a", text: "#294a59" },
  "#818cf8": { fill: "#f3f3fa", stroke: "#7b80a8", text: "#464c75" },
  "#34d399": { fill: "#f0f7f2", stroke: "#648f78", text: "#345b46" },
  "#10b981": { fill: "#eef6f1", stroke: "#648f78", text: "#345b46" },
  "#22c55e": { fill: "#eef6ef", stroke: "#6a9675", text: "#385c41" },
  "#a855f7": { fill: "#f6f1f9", stroke: "#9677ab", text: "#624575" },
  "#c084fc": { fill: "#f7f1f7", stroke: "#9b7d9f", text: "#654a69" },
  "#64748b": { fill: "#f2f4f6", stroke: "#7b8798", text: "#475568" },
};
const templateFills = new Set(["#0f141c", "#0f172a", "#17122a", "#181126", "#052e16", "#062b1e", "#1e1329"]);
const templateText = new Set(["#f0f9ff", "#e0f2fe", "#e0e7ff", "#ecfdf5", "#f3e8ff", "#bbf7d0", "#a7f3d0", "#f5d0fe", "#f8fafc", "#f4f4f5", "#cbd5e1"]);

export function nodeAppearance(style: NodeStyle, theme: Theme): NodeStyle {
  if (theme === "dark") return style;
  if (!templateFills.has(style.fillColor?.toLowerCase() ?? "")) return style;
  const palette = lightPalette[style.strokeColor?.toLowerCase() ?? ""] ?? {
    fill: "#ffffff", stroke: style.strokeColor ?? "#747c7c", text: "#2c302a",
  };
  return {
    ...style,
    fillColor: palette.fill,
    strokeColor: palette.stroke,
    textColor: !style.textColor || templateText.has(style.textColor.toLowerCase()) ? palette.text : style.textColor,
  };
}

export function connectorAppearance(color: string, theme: Theme): string {
  if (theme === "dark") return color;
  return lightPalette[color.toLowerCase()]?.stroke ?? ensureTextContrast(color, "#f7f7f4", 3);
}
