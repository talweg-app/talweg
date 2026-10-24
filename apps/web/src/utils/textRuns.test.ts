import { describe, expect, it } from "vitest";
import { colorTextRange, formatTextRange, normalizeExternalUrl, readableTextColor } from "./textRuns.js";
import { connectorLabelPoint } from "./connectorGeometry.js";

describe("text fragments", () => {
  it("colors only the selected substring and preserves surrounding colors", () => {
    expect(
      colorTextRange(
        [{ text: "Alpha ", color: "#8caecc" }, { text: "beta gamma" }],
        6,
        10,
        "#cb8584",
      ),
    ).toEqual([
      { text: "Alpha ", color: "#8caecc" },
      { text: "beta", color: "#cb8584" },
      { text: " gamma" },
    ]);
  });
  it("colors a selection spanning several existing runs without losing text", () => {
    expect(
      colorTextRange(
        [{ text: "ab" }, { text: "cd", color: "red" }, { text: "ef" }],
        1,
        5,
        "blue",
      ),
    ).toEqual([{ text: "a" }, { text: "bcde", color: "blue" }, { text: "f" }]);
  });
  it("chooses readable text for light and dark surfaces", () => {
    expect(readableTextColor("#eeeeeb")).toBe("#202223");
    expect(readableTextColor("#242729")).toBe("#eeeeeb");
  });
});

describe("connector labels", () => {
  it("uses distance along the route instead of a waypoint index", () => {
    expect(
      connectorLabelPoint(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 20 },
        ],
        [],
        20,
      ),
    ).toEqual({ x: 60, y: 0 });
  });
  it("finds a free section when the route center is covered by a node", () => {
    const point = connectorLabelPoint(
      [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
      ],
      [{ minX: 75, minY: -20, maxX: 125, maxY: 20, width: 50, height: 40 }],
      20,
    );
    expect(point).toEqual({ x: 50, y: 0 });
  });
});

describe("inline formatting", () => {
  it("preserves color and emphasis when applying a second format", () => {
    expect(formatTextRange([{ text: "Alpha beta", color: "blue", bold: true }], 6, 10, { italic: true })).toEqual([
      { text: "Alpha ", color: "blue", bold: true },
      { text: "beta", color: "blue", bold: true, italic: true },
    ]);
  });
  it("removes bold only from the selected letters without merging different styles", () => {
    expect(formatTextRange([{ text: "abcd", bold: true }], 1, 3, { bold: false })).toEqual([
      { text: "a", bold: true }, { text: "bc", bold: false }, { text: "d", bold: true },
    ]);
  });
});

describe("external addresses", () => {
  it("keeps http links and adds https to a bare address", () => {
    expect(normalizeExternalUrl(" example.com/docs ")).toBe("https://example.com/docs");
    expect(normalizeExternalUrl("http://example.com/docs")).toBe("http://example.com/docs");
  });
  it("rejects executable and unsupported URL protocols", () => {
    expect(normalizeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeExternalUrl("data:text/html,<script>test</script>")).toBeNull();
    expect(normalizeExternalUrl("ftp://example.com/file")).toBeNull();
    expect(normalizeExternalUrl("")).toBeNull();
  });
});
