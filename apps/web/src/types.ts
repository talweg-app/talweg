import type {
  ArrowCurveStyle,
  ArrowNode,
  BoundingBox,
  CanvasDocument,
  CanvasNode,
  CapsuleNode,
  CardNode,
  CompassAnchor,
  CylinderNode,
  DiamondNode,
  ImageNode,
  NodeId,
  Point2D,
  RectangleNode,
  ResizeHandle,
  StickerNode,
  TextNode,
  TransformBox2D,
} from "@talweg/core";

export type CanvasMode = "whiteboard" | "diagrams" | "mindmap";

export type ArrowEndpoint = "source" | "target";

export type ToolType =
  | "pen"
  | "markdown"
  | "image"
  | "ellipse"
  | "text"
  | "table"
  | "checklist"
  | "select"
  | "pan"
  | "rectangle"
  | "sticker"
  | "card"
  | "arrow"
  | "diamond"
  | "capsule"
  | "cylinder"
  | "delete";

export interface DragState {
  readonly mode:
    "move" | "pan" | "connect" | "box-select" | "marquee" | "resize";
  readonly startScreen: Point2D;
  readonly startWorld: Point2D;
  readonly lastScreen: Point2D;
  readonly currentWorld?: Point2D;
  readonly initialNodePositions?: ReadonlyMap<NodeId, Point2D>;
  readonly connectSourceId?: NodeId;
  readonly connectSourceAnchor?: CompassAnchor;
  readonly resizeHandle?: ResizeHandle;
  readonly initialBox?: TransformBox2D;
  readonly resizeNodeId?: NodeId;
}

export type {
  ArrowCurveStyle,
  ArrowNode,
  BoundingBox,
  CanvasDocument,
  CanvasNode,
  CapsuleNode,
  CardNode,
  CompassAnchor,
  CylinderNode,
  DiamondNode,
  ImageNode,
  NodeId,
  Point2D,
  RectangleNode,
  ResizeHandle,
  StickerNode,
  TextNode,
  TransformBox2D,
};
