# @talweg/core

Framework-independent geometry and scene types used by [Talweg](https://github.com/talweg-app/talweg).

This is currently a **private workspace package**, not an announced npm release. The proposed external name is `@talweg-app/core`, subject to namespace ownership and package validation. See the [publishing plan](../../docs/names-and-packages.md).

## Camera coordinates

```ts
import { screenToWorld, worldToScreen, zoomAtScreenPoint } from '@talweg/core';

const camera = { x: -200, y: -100, zoom: 2 };
const container = { x: 50, y: 30 };
const pointer = { x: 450, y: 330 };

const world = screenToWorld(pointer, camera, container);
// { x: 400, y: 250 }

const screen = worldToScreen(world, camera, container);
// { x: 450, y: 330 }

const closer = zoomAtScreenPoint(camera, pointer, 3, container);
// the same world point stays under the pointer
```

Coordinates are numeric canvas units. `screenBounds` is the screen-space position of the canvas container. The camera translation is applied before its zoom: `screen = (world + camera) * zoom + screenBounds`.

## Resize a box

```ts
import { resizeTransformBox } from '@talweg/core';

const { box } = resizeTransformBox(
  { x: 100, y: 80, width: 200, height: 100, rotation: 0 },
  'se',
  { x: 400, y: 230 },
  { minWidth: 40, minHeight: 30 },
);
// box: { x: 100, y: 80, width: 300, height: 150, rotation: 0 }
```

The pointer is in world coordinates. Resize handles keep the opposite anchor fixed. `resizeTransformBox` uses **radians** for `TransformBox2D.rotation`; scene-node rotation used by group bounds is in **degrees**. Convert explicitly when moving between those APIs.

## API areas

| Area | Exports |
| --- | --- |
| Coordinates | `screenToWorld`, `worldToScreen`, `viewportToWorld`, `worldToViewport` |
| Camera | `sanitizeCamera`, `panByScreenDelta`, `zoomAtScreenPoint`, `zoomAtViewportPoint`, `zoomToBounds`, `getViewportWorldBounds` |
| Resize | `resizeTransformBox`, `HANDLE_TOPOLOGY` and related types |
| Groups | `computeGroupBounds`, `groupNodes`, `ungroupNodes` |
| Scene types | `CanvasDocument`, `CanvasNode`, `NodeId`, `Point2D`, `BoundingBox`, `CameraViewport` |

This package does not render a canvas, provide React components, store projects or open peer connections. It ships ES modules and TypeScript declarations. Consumers should use the published entrypoint rather than importing files under `src/`.

## Work on the package

From the repository root:

```bash
pnpm --filter @talweg/core build
pnpm --filter @talweg/core test
pnpm --filter @talweg/core typecheck
```

License: [MIT](../../LICENSE).
