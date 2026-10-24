import type { CanvasNode } from "@talweg/core";
import type { Anchor } from "@talweg/router";

export function shapeAnchor(node: CanvasNode, anchor: Anchor): Anchor {
  const horizontal = anchor.direction === "EAST" || anchor.direction === "WEST";
  const positive = anchor.direction === "EAST" || anchor.direction === "SOUTH";
  let x = anchor.point.x * node.width;
  let y = anchor.point.y * node.height;
  const rx = node.width / 2;
  const ry = node.height / 2;
  // svg shapes use a 2..98 contour in their 100-unit viewBox
  if (node.type === "diamond") {
    if (horizontal) {
      y = Math.max(node.height * .02, Math.min(node.height * .98, y));
      const reach = Math.max(0, rx * .96 * (1 - Math.abs(y - ry) / Math.max(ry * .96, 1)));
      x = rx + (positive ? reach : -reach);
    } else {
      x = Math.max(node.width * .02, Math.min(node.width * .98, x));
      const reach = Math.max(0, ry * .96 * (1 - Math.abs(x - rx) / Math.max(rx * .96, 1)));
      y = ry + (positive ? reach : -reach);
    }
  } else if (node.type === "ellipse") {
    if (horizontal) x = rx + (positive ? 1 : -1) * rx * Math.sqrt(Math.max(0, 1 - ((y - ry) / Math.max(ry, 1)) ** 2));
    else y = ry + (positive ? 1 : -1) * ry * Math.sqrt(Math.max(0, 1 - ((x - rx) / Math.max(rx, 1)) ** 2));
  } else if (node.type === "cylinder") {
    if (horizontal) {
      y = Math.max(node.height * .02, Math.min(node.height * .98, y));
      const centerY = Math.max(node.height * .2, Math.min(node.height * .8, y));
      x = rx + (positive ? 1 : -1) * node.width * .48 * Math.sqrt(Math.max(0, 1 - ((y - centerY) / Math.max(node.height * .18, 1)) ** 2));
    } else {
      x = Math.max(node.width * .02, Math.min(node.width * .98, x));
      const reach = node.height * .18 * Math.sqrt(Math.max(0, 1 - ((x - rx) / Math.max(node.width * .48, 1)) ** 2));
      y = positive ? node.height * .8 + reach : node.height * .2 - reach;
    }
  } else {
    const radius = Math.min(rx, ry, node.type === "capsule" ? Math.min(rx, ry) : (typeof node.style.cornerRadius === "number" ? node.style.cornerRadius : 6));
    if (radius > 0 && horizontal) {
      const centerY = Math.max(radius, Math.min(node.height - radius, y));
      const inset = radius - Math.sqrt(Math.max(0, radius ** 2 - (y - centerY) ** 2));
      x = positive ? node.width - inset : inset;
    } else if (radius > 0) {
      const centerX = Math.max(radius, Math.min(node.width - radius, x));
      const inset = radius - Math.sqrt(Math.max(0, radius ** 2 - (x - centerX) ** 2));
      y = positive ? node.height - inset : inset;
    }
  }
  return { ...anchor, offset: { x: x - anchor.point.x * node.width, y: y - anchor.point.y * node.height } };
}
