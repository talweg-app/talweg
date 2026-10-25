import { describe, expect, it } from "vitest";
import { createMicroservicesTemplate, createSprintMindmapTemplate } from "./starterTemplates.js";
import { contrastRatio } from "./colorContrast.js";
import { nodeAppearance, connectorAppearance } from "./sceneAppearance.js";

describe("light scene appearance", () => {
  it("gives both starter diagrams light surfaces with readable text without rewriting their colours", () => {
    for (const scene of [createMicroservicesTemplate("micro"), createSprintMindmapTemplate("sprint")]) {
      for (const node of Object.values(scene.nodes)) {
        const style = Object.freeze({ ...node.style });
        if (node.type === "arrow") {
          expect(contrastRatio(connectorAppearance(style.strokeColor ?? "#64748b", "light"), "#f7f7f4")).toBeGreaterThanOrEqual(3);
          continue;
        }
        const light = nodeAppearance(style, "light");
        expect(contrastRatio(light.fillColor ?? "#ffffff", "#ffffff")).toBeLessThan(1.3);
        expect(contrastRatio(light.textColor ?? "#000000", light.fillColor ?? "#ffffff")).toBeGreaterThanOrEqual(4.5);
        expect(style).toEqual(node.style);
        expect(nodeAppearance(style, "dark")).toBe(style);
      }
    }
  });
  it("preserves custom fills, custom text colours and transparent text blocks", () => {
    for (const style of [
      { fillColor: "#101112", textColor: "#eeeeeb", strokeColor: "#727777" },
      { fillColor: "transparent", textColor: "#eeeeeb", strokeColor: "#818cf8" },
      { fillColor: "#e9dda7", textColor: "#343024" },
    ]) expect(nodeAppearance(style, "light")).toBe(style);
    const customText = nodeAppearance({ fillColor: "#0f141c", textColor: "#cb8584", strokeColor: "#38bdf8" }, "light");
    expect(customText.textColor).toBe("#cb8584");
    expect(contrastRatio(customText.fillColor ?? "#000000", "#ffffff")).toBeLessThan(1.3);
    const customBorder = nodeAppearance({ fillColor: "#0f141c", textColor: "#f0f9ff", strokeColor: "#cb8584" }, "light");
    expect(customBorder.strokeColor).toBe("#cb8584");
    expect(customBorder.fillColor).toBe("#ffffff");
  });
  it("keeps dark connectors unchanged and makes pale custom lines visible on paper", () => {
    expect(connectorAppearance("#38bdf8", "dark")).toBe("#38bdf8");
    expect(connectorAppearance("#123456", "light")).toBe("#123456");
    expect(contrastRatio(connectorAppearance("#ffffff", "light"), "#f7f7f4")).toBeGreaterThanOrEqual(3);
  });
});
