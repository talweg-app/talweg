import type { CanvasDocument } from "@talweg/core";
import { describe, expect, it } from "vitest";
import { anchorForFace, getAnchorPoint } from "@talweg/router";
import { createMicroservicesTemplate } from "./starterTemplates.js";
import { createCanvasNode } from "./createCanvasNode.js";
import { pageNodes } from "./pageNodes.js";
import { shapeAnchor } from "./shapeAnchors.js";
import {
  nodeToBoundingBox,
  buildPortSlotMap,
  computeConnectorGeometry,
  stabilizeConnections,
} from "./connectorGeometry.js";

describe("page ownership", () => {
  it("shows legacy nodes only on the original page, never on every page", () => {
    const document = createMicroservicesTemplate();
    expect(Object.keys(pageNodes(document, "page-1"))).toHaveLength(11);
    expect(Object.keys(pageNodes(document, "page-2"))).toHaveLength(0);
    const node = Object.values(document.nodes)[0];
    if (!node) throw new Error("Missing template node");
    node.pageId = "page-2";
    expect(Object.keys(pageNodes(document, "page-1"))).toHaveLength(10);
    expect(Object.keys(pageNodes(document, "page-2"))).toEqual([node.id]);
  });
});

describe("shape connection points", () => {
  it.each(["diamond", "ellipse", "capsule", "cylinder"] as const)(
    "keeps distributed ports on the %s contour",
    (type) => {
      const node = createCanvasNode(type, { x: 100, y: 100 }, "whiteboard");
      if (!node) throw new Error("Missing node");
      for (const face of ["n", "s", "e", "w"] as const) {
        for (const slot of [0.125, 0.25, 0.5, 0.75, 0.875]) {
          const point = getAnchorPoint(
            nodeToBoundingBox(node),
            shapeAnchor(node, anchorForFace(face, slot)),
          );
          const x = point.x - node.x;
          const y = point.y - node.y;
          if (type === "diamond")
            expect(
              Math.abs(x - node.width / 2) / (node.width * 0.48) +
                Math.abs(y - node.height / 2) / (node.height * 0.48),
            ).toBeCloseTo(1, 8);
          if (type === "ellipse")
            expect(
              ((x - node.width / 2) / (node.width / 2)) ** 2 +
                ((y - node.height / 2) / (node.height / 2)) ** 2,
            ).toBeCloseTo(1, 8);
          if (type === "capsule") {
            const radius = Math.min(node.width, node.height) / 2;
            const cx = Math.max(radius, Math.min(node.width - radius, x));
            const cy = Math.max(radius, Math.min(node.height - radius, y));
            expect(Math.hypot(x - cx, y - cy)).toBeCloseTo(radius, 8);
          }
          if (type === "cylinder") {
            const centerY =
              face === "n"
                ? node.height * 0.2
                : face === "s"
                  ? node.height * 0.8
                  : Math.max(node.height * 0.2, Math.min(node.height * 0.8, y));
            expect(
              ((x - node.width / 2) / (node.width * 0.48)) ** 2 +
                ((y - centerY) / (node.height * 0.18)) ** 2,
            ).toBeCloseTo(1, 8);
          }
        }
      }
    },
  );

  it("keeps many connectors attached to a diamond after it is resized", () => {
    const document = createMicroservicesTemplate();
    const source = Object.values(document.nodes).find(
      (node) => node.type === "capsule",
    );
    const target = Object.values(document.nodes).find(
      (node) => node.type === "diamond",
    );
    const original = Object.values(document.nodes).find(
      (node) => node.type === "arrow",
    );
    if (!source || !target || !original)
      throw new Error("Missing template elements");
    for (let index = 0; index < 8; index++) {
      const id = `${original.id}-${String(index)}` as typeof original.id;
      document.nodes[id] = {
        ...original,
        id,
        data: {
          sourceId: source.id,
          targetId: target.id,
          sourceAnchor: "e",
          targetAnchor: "w",
        },
      };
    }
    for (const width of [180, 360]) {
      target.width = width;
      const ports = buildPortSlotMap(document);
      for (const arrow of Object.values(document.nodes)) {
        if (arrow.type !== "arrow" || arrow.data.targetId !== target.id)
          continue;
        const geometry = computeConnectorGeometry(arrow, document, ports);
        expect(geometry).not.toBeNull();
        if (!geometry) continue;
        expect(
          Math.abs(geometry.targetPoint.x - target.x - width / 2) /
            (width * 0.48) +
            Math.abs(geometry.targetPoint.y - target.y - target.height / 2) /
              (target.height * 0.48),
        ).toBeCloseTo(1, 8);
        expect(geometry.lineSvgPath).not.toMatch(/NaN|Infinity/);
      }
    }
  });
});

it("honors a manually chosen source face when the target face is automatic", () => {
  const document = createMicroservicesTemplate();
  const arrow = Object.values(document.nodes).find(
    (node) => node.type === "arrow",
  );
  if (!arrow) throw new Error("Missing connector");
  const source = document.nodes[arrow.data.sourceId];
  if (!source) throw new Error("Missing source");
  arrow.data = {
    sourceId: arrow.data.sourceId,
    targetId: arrow.data.targetId,
    sourceAnchor: "w",
    curveStyle: "bezier",
  };
  const geometry = computeConnectorGeometry(
    arrow,
    document,
    buildPortSlotMap(document),
  );
  expect(geometry?.sourcePoint.x).toBe(source.x);
});

it("keeps automatic connection sides stable after the target moves above the source", () => {
  const document = createMicroservicesTemplate();
  const arrow = Object.values(document.nodes).find(
    (node) => node.type === "arrow",
  );
  if (!arrow) throw new Error("Missing arrow");
  arrow.data = {
    sourceId: arrow.data.sourceId,
    targetId: arrow.data.targetId,
    curveStyle: "bezier",
  };
  const before = computeConnectorGeometry(
    arrow,
    document,
    buildPortSlotMap(document),
  );
  const fixed = stabilizeConnections(document);
  const target = document.nodes[arrow.data.targetId];
  const source = document.nodes[arrow.data.sourceId];
  if (!target || !source) throw new Error("Missing nodes");
  const moved: CanvasDocument = {
    ...fixed,
    nodes: {
      ...fixed.nodes,
      [target.id]: { ...target, x: source.x + 20, y: source.y - 400 },
    },
  };
  const fixedArrow = moved.nodes[arrow.id];
  if (fixedArrow?.type !== "arrow") throw new Error("Missing fixed arrow");
  const after = computeConnectorGeometry(
    fixedArrow,
    moved,
    buildPortSlotMap(moved),
  );
  expect(after?.sourcePoint.x).toBe(before?.sourcePoint.x);
  expect(arrow.data.sourceAnchor).toBeUndefined();
  expect(arrow.data.targetAnchor).toBeUndefined();
  expect(stabilizeConnections(fixed)).toBe(fixed);
});
