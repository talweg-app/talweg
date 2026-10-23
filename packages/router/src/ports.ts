import type { Point2D } from "@talweg/core";
import type { Anchor, Direction } from "./anchors.js";

export type CompassFace = "n" | "s" | "e" | "w";

export interface CompassPort {
  readonly id: string;
  readonly face: CompassFace;
  readonly order: number;
}

interface FaceConfig {
  readonly axis: "x" | "y";
  readonly fixed: number;
  readonly direction: Direction;
}

const FACE_CONFIG: Record<CompassFace, FaceConfig> = {
  n: { axis: "x", fixed: 0, direction: "NORTH" },
  s: { axis: "x", fixed: 1, direction: "SOUTH" },
  e: { axis: "y", fixed: 1, direction: "EAST" },
  w: { axis: "y", fixed: 0, direction: "WEST" },
};

export function anchorForFace(face: CompassFace, slot = 0.5): Anchor {
  const config = FACE_CONFIG[face];
  const point: Point2D =
    config.axis === "x"
      ? { x: slot, y: config.fixed }
      : { x: config.fixed, y: slot };

  return { point, direction: config.direction };
}

function comparePorts(first: CompassPort, second: CompassPort): number {
  return first.order - second.order || first.id.localeCompare(second.id);
}

export function distributeCompassPorts(
  ports: readonly CompassPort[],
): ReadonlyMap<string, Anchor> {
  const groups = new Map<CompassFace, CompassPort[]>();

  for (const port of ports) {
    const group = groups.get(port.face);

    if (group === undefined) {
      groups.set(port.face, [port]);
    } else {
      group.push(port);
    }
  }

  const anchors = new Map<string, Anchor>();

  for (const [face, group] of groups) {
    const sorted = [...group].sort(comparePorts);
    const step = sorted.length + 1;

    for (let index = 0; index < sorted.length; index += 1) {
      const port = sorted[index]!;
      anchors.set(port.id, anchorForFace(face, (index + 1) / step));
    }
  }

  return anchors;
}
