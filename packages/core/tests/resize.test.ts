import { describe, expect, it } from "vitest";
import {
  HANDLE_TOPOLOGY,
  resizeTransformBox,
} from "../src/index.js";
import type {
  NormalizedAnchor,
  ResizeHandle,
  TransformBox2D,
} from "../src/index.js";

function computeAnchorWorld(box: TransformBox2D, anchor: NormalizedAnchor) {
  const cosT = Math.cos(box.rotation);
  const sinT = Math.sin(box.rotation);
  const cx = box.x + cosT * (box.width / 2) - sinT * (box.height / 2);
  const cy = box.y + sinT * (box.width / 2) + cosT * (box.height / 2);
  return {
    x: cx + cosT * ((anchor.u - 0.5) * box.width) - sinT * ((anchor.v - 0.5) * box.height),
    y: cy + sinT * ((anchor.u - 0.5) * box.width) + cosT * ((anchor.v - 0.5) * box.height),
  };
}

describe("HANDLE_TOPOLOGY", () => {
  it("defines opposite anchors for all 8 handles", () => {
    const handles: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
    for (const h of handles) {
      const entry = HANDLE_TOPOLOGY[h];
      expect(entry).toBeDefined();
      expect(entry.handle.u + entry.anchor.u).toBeCloseTo(1, 6);
      expect(entry.handle.v + entry.anchor.v).toBeCloseTo(1, 6);
    }
  });
});

describe("resizeTransformBox: handle invariants and translation", () => {
  const baseBox: TransformBox2D = {
    x: 100,
    y: 100,
    width: 200,
    height: 100,
    rotation: 0,
  };

  it("resizes se handle preserving nw anchor", () => {
    const result = resizeTransformBox(baseBox, "se", { x: 350, y: 250 });
    expect(result.box.x).toBeCloseTo(100, 6);
    expect(result.box.y).toBeCloseTo(100, 6);
    expect(result.box.width).toBeCloseTo(250, 6);
    expect(result.box.height).toBeCloseTo(150, 6);
    expect(result.anchorWorld).toEqual({ x: 100, y: 100 });
  });

  it("resizes nw handle preserving se anchor", () => {
    const result = resizeTransformBox(baseBox, "nw", { x: 50, y: 60 });
    expect(result.box.x).toBeCloseTo(50, 6);
    expect(result.box.y).toBeCloseTo(60, 6);
    expect(result.box.width).toBeCloseTo(250, 6);
    expect(result.box.height).toBeCloseTo(140, 6);
    expect(result.anchorWorld).toEqual({ x: 300, y: 200 });

    const finalAnchor = computeAnchorWorld(result.box, HANDLE_TOPOLOGY.nw.anchor);
    expect(finalAnchor.x).toBeCloseTo(300, 6);
    expect(finalAnchor.y).toBeCloseTo(200, 6);
  });

  it("resizes ne handle preserving sw anchor", () => {
    const result = resizeTransformBox(baseBox, "ne", { x: 340, y: 70 });
    expect(result.box.x).toBeCloseTo(100, 6);
    expect(result.box.y).toBeCloseTo(70, 6);
    expect(result.box.width).toBeCloseTo(240, 6);
    expect(result.box.height).toBeCloseTo(130, 6);

    const finalAnchor = computeAnchorWorld(result.box, HANDLE_TOPOLOGY.ne.anchor);
    expect(finalAnchor.x).toBeCloseTo(100, 6);
    expect(finalAnchor.y).toBeCloseTo(200, 6);
  });

  it("resizes sw handle preserving ne anchor", () => {
    const result = resizeTransformBox(baseBox, "sw", { x: 80, y: 240 });
    expect(result.box.x).toBeCloseTo(80, 6);
    expect(result.box.y).toBeCloseTo(100, 6);
    expect(result.box.width).toBeCloseTo(220, 6);
    expect(result.box.height).toBeCloseTo(140, 6);

    const finalAnchor = computeAnchorWorld(result.box, HANDLE_TOPOLOGY.sw.anchor);
    expect(finalAnchor.x).toBeCloseTo(300, 6);
    expect(finalAnchor.y).toBeCloseTo(100, 6);
  });

  it("resizes e handle preserving w anchor and initial height", () => {
    const result = resizeTransformBox(baseBox, "e", { x: 360, y: 150 });
    expect(result.box.x).toBeCloseTo(100, 6);
    expect(result.box.y).toBeCloseTo(100, 6);
    expect(result.box.width).toBeCloseTo(260, 6);
    expect(result.box.height).toBeCloseTo(100, 6);

    const finalAnchor = computeAnchorWorld(result.box, HANDLE_TOPOLOGY.e.anchor);
    expect(finalAnchor.x).toBeCloseTo(100, 6);
    expect(finalAnchor.y).toBeCloseTo(150, 6);
  });

  it("resizes w handle preserving e anchor and initial height", () => {
    const result = resizeTransformBox(baseBox, "w", { x: 40, y: 150 });
    expect(result.box.x).toBeCloseTo(40, 6);
    expect(result.box.y).toBeCloseTo(100, 6);
    expect(result.box.width).toBeCloseTo(260, 6);
    expect(result.box.height).toBeCloseTo(100, 6);

    const finalAnchor = computeAnchorWorld(result.box, HANDLE_TOPOLOGY.w.anchor);
    expect(finalAnchor.x).toBeCloseTo(300, 6);
    expect(finalAnchor.y).toBeCloseTo(150, 6);
  });

  it("resizes s handle preserving n anchor and initial width", () => {
    const result = resizeTransformBox(baseBox, "s", { x: 200, y: 260 });
    expect(result.box.x).toBeCloseTo(100, 6);
    expect(result.box.y).toBeCloseTo(100, 6);
    expect(result.box.width).toBeCloseTo(200, 6);
    expect(result.box.height).toBeCloseTo(160, 6);

    const finalAnchor = computeAnchorWorld(result.box, HANDLE_TOPOLOGY.s.anchor);
    expect(finalAnchor.x).toBeCloseTo(200, 6);
    expect(finalAnchor.y).toBeCloseTo(100, 6);
  });

  it("resizes n handle preserving s anchor and initial width", () => {
    const result = resizeTransformBox(baseBox, "n", { x: 200, y: 40 });
    expect(result.box.x).toBeCloseTo(100, 6);
    expect(result.box.y).toBeCloseTo(40, 6);
    expect(result.box.width).toBeCloseTo(200, 6);
    expect(result.box.height).toBeCloseTo(160, 6);

    const finalAnchor = computeAnchorWorld(result.box, HANDLE_TOPOLOGY.n.anchor);
    expect(finalAnchor.x).toBeCloseTo(200, 6);
    expect(finalAnchor.y).toBeCloseTo(200, 6);
  });
});

describe("resizeTransformBox: anti-flip and min-size clamping", () => {
  const baseBox: TransformBox2D = {
    x: 100,
    y: 100,
    width: 200,
    height: 100,
    rotation: 0,
  };

  it("clamps to default minimum dimensions 40x30 when cursor flips beyond anchor", () => {
    const result = resizeTransformBox(baseBox, "se", { x: 50, y: 50 });
    expect(result.box.width).toBe(40);
    expect(result.box.height).toBe(30);
    expect(result.box.x).toBe(100);
    expect(result.box.y).toBe(100);

    const finalAnchor = computeAnchorWorld(result.box, HANDLE_TOPOLOGY.se.anchor);
    expect(finalAnchor.x).toBeCloseTo(100, 6);
    expect(finalAnchor.y).toBeCloseTo(100, 6);
  });

  it("respects custom minWidth and minHeight options", () => {
    const result = resizeTransformBox(
      baseBox,
      "se",
      { x: 110, y: 110 },
      { minWidth: 75, minHeight: 65 },
    );
    expect(result.box.width).toBe(75);
    expect(result.box.height).toBe(65);
  });
});

describe("resizeTransformBox: proportional aspect ratio scaling", () => {
  const baseBox: TransformBox2D = {
    x: 100,
    y: 100,
    width: 200,
    height: 100,
    rotation: 0,
  };

  it("scales corner with horizontal dominance when lockAspectRatio is true", () => {
    const result = resizeTransformBox(
      baseBox,
      "se",
      { x: 400, y: 150 },
      { lockAspectRatio: true },
    );
    expect(result.box.width).toBeCloseTo(300, 6);
    expect(result.box.height).toBeCloseTo(150, 6);
    expect(result.box.width / result.box.height).toBeCloseTo(2, 6);
  });

  it("scales corner with vertical dominance when isShiftPressed is true", () => {
    const result = resizeTransformBox(
      baseBox,
      "se",
      { x: 220, y: 250 },
      { isShiftPressed: true },
    );
    expect(result.box.height).toBeCloseTo(150, 6);
    expect(result.box.width).toBeCloseTo(300, 6);
    expect(result.box.width / result.box.height).toBeCloseTo(2, 6);
  });

  it("preserves aspect ratio on vertical 1D handles", () => {
    const result = resizeTransformBox(
      baseBox,
      "s",
      { x: 200, y: 250 },
      { lockAspectRatio: true },
    );
    expect(result.box.height).toBeCloseTo(150, 6);
    expect(result.box.width).toBeCloseTo(300, 6);

    const finalAnchor = computeAnchorWorld(result.box, HANDLE_TOPOLOGY.s.anchor);
    expect(finalAnchor.x).toBeCloseTo(200, 6);
    expect(finalAnchor.y).toBeCloseTo(100, 6);
  });

  it("preserves aspect ratio on vertical 1D handle with minimum width clamping", () => {
    const result = resizeTransformBox(
      baseBox,
      "n",
      { x: 200, y: 190 },
      { lockAspectRatio: true, minWidth: 80, minHeight: 10 },
    );
    expect(result.box.width).toBe(80);
    expect(result.box.height).toBe(40);
  });

  it("preserves aspect ratio on horizontal 1D handles", () => {
    const result = resizeTransformBox(
      baseBox,
      "e",
      { x: 400, y: 150 },
      { lockAspectRatio: true },
    );
    expect(result.box.width).toBeCloseTo(300, 6);
    expect(result.box.height).toBeCloseTo(150, 6);

    const finalAnchor = computeAnchorWorld(result.box, HANDLE_TOPOLOGY.e.anchor);
    expect(finalAnchor.x).toBeCloseTo(100, 6);
    expect(finalAnchor.y).toBeCloseTo(150, 6);
  });

  it("preserves aspect ratio on horizontal 1D handle with minimum height clamping", () => {
    const tallBox: TransformBox2D = {
      x: 100,
      y: 100,
      width: 100,
      height: 200,
      rotation: 0,
    };
    const result = resizeTransformBox(
      tallBox,
      "w",
      { x: 190, y: 200 },
      { lockAspectRatio: true, minWidth: 10, minHeight: 60 },
    );
    expect(result.box.height).toBe(60);
    expect(result.box.width).toBe(30);
  });

  it("enforces minimum bounds when scaling down corner under aspect ratio lock", () => {
    const tallBox: TransformBox2D = {
      x: 100,
      y: 100,
      width: 50,
      height: 100,
      rotation: 0,
    };
    const result = resizeTransformBox(
      tallBox,
      "se",
      { x: 105, y: 105 },
      { lockAspectRatio: true, minWidth: 40, minHeight: 30 },
    );
    expect(result.box.width).toBe(40);
    expect(result.box.height).toBe(80);
  });

  it("enforces minimum height scaled bounds when aspect ratio lock requires higher height", () => {
    const wideBox: TransformBox2D = {
      x: 100,
      y: 100,
      width: 200,
      height: 50,
      rotation: 0,
    };
    const result = resizeTransformBox(
      wideBox,
      "se",
      { x: 105, y: 105 },
      { lockAspectRatio: true, minWidth: 20, minHeight: 30 },
    );
    expect(result.box.height).toBe(30);
    expect(result.box.width).toBe(120);
  });
});

describe("resizeTransformBox: rotation invariants", () => {
  const angles = [
    0,
    Math.PI / 4,
    Math.PI / 2,
    Math.PI,
    -Math.PI / 3,
    (3 * Math.PI) / 4,
  ];

  const handles: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

  for (const rotation of angles) {
    it(`maintains Delta A_world = 0 at angle ${rotation.toFixed(3)} across all handles`, () => {
      const box: TransformBox2D = {
        x: 150,
        y: 200,
        width: 160,
        height: 90,
        rotation,
      };

      for (const handle of handles) {
        const { anchor } = HANDLE_TOPOLOGY[handle];
        const initialAnchor = computeAnchorWorld(box, anchor);

        const testCursor = {
          x: initialAnchor.x + 250 * Math.cos(rotation + 0.2),
          y: initialAnchor.y + 250 * Math.sin(rotation + 0.2),
        };

        const result = resizeTransformBox(box, handle, testCursor);

        expect(result.anchorWorld.x).toBeCloseTo(initialAnchor.x, 6);
        expect(result.anchorWorld.y).toBeCloseTo(initialAnchor.y, 6);

        const newAnchor = computeAnchorWorld(result.box, anchor);
        expect(newAnchor.x).toBeCloseTo(initialAnchor.x, 6);
        expect(newAnchor.y).toBeCloseTo(initialAnchor.y, 6);
        expect(result.box.rotation).toBeCloseTo(rotation, 6);
      }
    });
  }

  it("supports rotated boxes under aspect ratio lock", () => {
    const box: TransformBox2D = {
      x: 100,
      y: 100,
      width: 120,
      height: 80,
      rotation: Math.PI / 3,
    };

    const initialAnchor = computeAnchorWorld(box, HANDLE_TOPOLOGY.se.anchor);
    const result = resizeTransformBox(
      box,
      "se",
      { x: initialAnchor.x + 300, y: initialAnchor.y + 200 },
      { lockAspectRatio: true },
    );

    expect(result.box.width / result.box.height).toBeCloseTo(120 / 80, 5);

    const newAnchor = computeAnchorWorld(result.box, HANDLE_TOPOLOGY.se.anchor);
    expect(newAnchor.x).toBeCloseTo(initialAnchor.x, 6);
    expect(newAnchor.y).toBeCloseTo(initialAnchor.y, 6);
  });
});
