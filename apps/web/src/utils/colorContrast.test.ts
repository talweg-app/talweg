import { describe, expect, it } from "vitest";
import { contrastRatio, ensureTextContrast, readableTextColor, resolveFillColor } from "./colorContrast.js";
import { createCanvasNode } from "./createCanvasNode.js";

describe("text against node fills", () => {
  it("keeps readable colours and recovers white-on-white and black-on-black text", () => {
    expect(ensureTextContrast("#8caecc", "#242729")).toBe("#8caecc");
    expect(ensureTextContrast("#eeeeeb", "#eeeeeb")).toBe("#202223");
    expect(ensureTextContrast("#202223", "#101112")).toBe("#eeeeeb");
  });
  it("keeps a readable tint for coloured fragments across light and dark fills", () => {
    for (const fill of ["#ffffff", "#eeeeeb", "#e9dda7", "#777777", "#242729", "#101112"]) {
      for (const text of ["#ffffff", "#000000", "#cb8584", "#8caecc", "#e9dda7", "#83b7a3"]) {
        expect(contrastRatio(ensureTextContrast(text, fill), fill)).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrastRatio(readableTextColor(fill), fill)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("composites transparent fills against the actual canvas or table background", () => {
    expect(resolveFillColor("transparent", "#f8f9fa")).toBe("#f8f9fa");
    expect(resolveFillColor("#fff8", "#000000")).toBe("#888888");
    expect(resolveFillColor("rgba(255, 255, 255, 0.5)", "#000000")).toBe("#808080");
    expect(resolveFillColor("#fff", "#101112")).toBe("#ffffff");
    expect(contrastRatio("#0000", "#ffffff")).toBe(1);
    expect(contrastRatio(ensureTextContrast("#0000", "#ffffff"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
  it("starts light-theme nodes with light surfaces and leaves text backgrounds transparent", () => {
    expect(createCanvasNode("rectangle", { x: 0, y: 0 }, "whiteboard", "light")?.style).toMatchObject({ fillColor: "#ffffff", textColor: "#202223" });
    expect(createCanvasNode("text", { x: 0, y: 0 }, "whiteboard", "light")?.style).toMatchObject({ fillColor: "transparent", textColor: "#202223" });
  });
});
