import { describe, it, expect } from "vitest";
import { notePreview } from "./notePreview.js";
describe("canvas note preview", () => {
  it("shows a complete formula on a compact card instead of cutting LaTeX source", () => {
    expect(notePreview("## A theorem\n\n$$a^2+b^2=c^2$$\n\nAn explanation", true)).toBe("$$a^2+b^2=c^2$$");
  });
  it("keeps whole Markdown blocks on a larger card", () => {
    expect(notePreview("## Overview\n\nA **useful** observation.\n\n- First\n- Second", false)).toContain("A **useful** observation.");
    expect(notePreview("One\n\nTwo\n\nThree", true)).toBe("One\n\nTwo\n\nThree");
  });
  it("bounds expensive previews without cutting inside a long block", () => {
    expect(notePreview("Small\n\n" + "x".repeat(1500), false)).toBe("Small");
    expect(notePreview("", true)).toBe("");
    expect(notePreview("$$" + "x".repeat(1500) + "$$", true)).toBe("");
  });
});
