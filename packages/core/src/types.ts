declare const nodeIdBrand: unique symbol;
declare const documentIdBrand: unique symbol;

export type NodeId = string & { readonly [nodeIdBrand]: true };
export type GroupId = NodeId;
export type DocumentId = string & { readonly [documentIdBrand]: true };
export type FractionalIndex = string;
export type PageId = string;

export type NodeType =
  | "table"
  | "checklist"
  | "rectangle"
  | "sticker"
  | "card"
  | "text"
  | "group"
  | "frame"
  | "ellipse"
  | "arrow"
  | "line"
  | "diamond"
  | "image"
  | "capsule"
  | "cylinder";

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface Size2D {
  readonly width: number;
  readonly height: number;
}

export interface BoundingBox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly width: number;
  readonly height: number;
}

export type AffineTransformMatrix = readonly [
  number, // a: x scale
  number, // b: y skew
  number, // c: x skew
  number, // d: y scale
  number, // e: x translation
  number, // f: y translation
];

export type StrokeDashStyle = "solid" | "dashed" | "dotted" | "none";
export type FillPatternStyle = "solid" | "semi" | "pattern" | "none";
export type TextAlign = "left" | "center" | "right" | "justify";
export type VerticalAlign = "top" | "middle" | "bottom";
export type FontWeight = "normal" | "medium" | "semibold" | "bold" | 400 | 500 | 600 | 700;

export interface NodeStyle {
  fillColor?: string;
  fillOpacity?: number;
  fillPattern?: FillPatternStyle;

  strokeColor?: string;
  strokeWidth?: number;
  strokeDash?: StrokeDashStyle;
  strokeDashArray?: readonly number[];
  strokeOpacity?: number;

  cornerRadius?: number | readonly [number, number, number, number];

  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: FontWeight;
  textAlign?: TextAlign;
  verticalAlign?: VerticalAlign;
  lineHeight?: number;
}

export interface CanvasNodeBase {
  readonly id: NodeId;
  readonly type: NodeType;
  pageId?: PageId;

  /** Top-left position in the coordinate space of `parentId`, or world space for roots. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Clockwise rotation in degrees. */
  rotation: number;

  zIndex: number;
  zIndexKey?: FractionalIndex;
  opacity: number;

  parentId: GroupId | null;

  isLocked: boolean;
  isVisible: boolean;

  style: NodeStyle;

  meta?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface RectangleNode extends CanvasNodeBase {
  readonly type: "rectangle";
  data?: {
    label?: string;
    aspectRatioLocked?: boolean;
  };
}

export type StickerShapeType = "square" | "rectangle";

export interface StickerNode extends CanvasNodeBase {
  readonly type: "sticker";
  data: {
    content: string;
    stickerShape: StickerShapeType;
    autoFontSize?: boolean;
    authorId?: string;
  };
}

export type CardStatus = "todo" | "in_progress" | "done" | "blocked" | (string & {});

export interface CardTag {
  readonly id: string;
  readonly label: string;
  readonly color: string;
}

export interface CardNode extends CanvasNodeBase {
  readonly type: "card";
  data: {
    title: string;
    description?: string;
    status?: CardStatus;
    assigneeId?: string;
    dueDate?: number;
    tags?: readonly CardTag[];
    customFields?: Record<string, unknown>;
  };
}

export interface TextNode extends CanvasNodeBase {
  readonly type: "text";
  data: {
    text: string;
    autoSize: boolean;
    maxWidth?: number;
  };
}

export type GroupBoundingBoxMode = "dynamic" | "fixed";

export interface CanvasGroup extends CanvasNodeBase {
  readonly type: "group";
  data: {
    childIds: readonly NodeId[];
    boundingBoxMode: GroupBoundingBoxMode;
    padding?: number;
    isCollapsed?: boolean;
  };
}

export type ArrowMarkerType = "none" | "arrow" | "triangle" | "diamond";

export type CompassAnchor = "n" | "s" | "e" | "w";
export type ArrowCurveStyle = "orthogonal" | "bezier";

export interface ArrowNode extends CanvasNodeBase {
  readonly type: "arrow";
  data: {
    sourceId: NodeId;
    targetId: NodeId;
    startArrow?: ArrowMarkerType;
    endArrow?: ArrowMarkerType;
    label?: string;
    sourceAnchor?: CompassAnchor;
    targetAnchor?: CompassAnchor;
    curveStyle?: ArrowCurveStyle;
  };
}

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export interface DiamondNode extends CanvasNodeBase {
  readonly type: "diamond";
  data?: {
    label?: string;
    aspectRatioLocked?: boolean;
  };
}

export interface CapsuleNode extends CanvasNodeBase {
  readonly type: "capsule";
  data?: {
    label?: string;
  };
}

export interface CylinderNode extends CanvasNodeBase {
  readonly type: "cylinder";
  data?: {
    label?: string;
  };
}

export interface ImageNodeData {
  readonly assetId: string;
  readonly naturalWidth: number;
  readonly naturalHeight: number;
  readonly mimeType?: string;
  readonly altText?: string;
  readonly placeholderBlurDataUrl?: string;
}

export interface ImageNode extends CanvasNodeBase {
  readonly type: "image";
  readonly data: ImageNodeData;
}

export interface EllipseNode extends CanvasNodeBase {
  readonly type: "ellipse";
  data?: { label?: string };
}

export interface TableNode extends CanvasNodeBase {
  readonly type: "table";
  data: { cells: string[][] };
}

export interface ChecklistNode extends CanvasNodeBase {
  readonly type: "checklist";
  data: {
    title: string;
    items: { id: string; text: string; checked: boolean }[];
  };
}

export type CanvasNode =
  | EllipseNode
  | TableNode
  | ChecklistNode
  | RectangleNode
  | StickerNode
  | CardNode
  | TextNode
  | CanvasGroup
  | ArrowNode
  | DiamondNode
  | ImageNode
  | CapsuleNode
  | CylinderNode;

export interface CameraViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface CanvasPage {
  readonly id: PageId;
  name: string;
  order: number;
  viewport?: CameraViewport;
  createdAt: number;
  updatedAt: number;
}

export interface GridSettings {
  enabled: boolean;
  size: number;
  snapToGrid: boolean;
  gridType: "dots" | "lines" | "crosses";
}

export interface CanvasDocument {
  readonly id: DocumentId;
  readonly schemaVersion: number;
  name: string;

  activePageId?: PageId;
  pages?: Record<PageId, CanvasPage>;

  nodes: Record<NodeId, CanvasNode>;

  rootNodeIds: readonly NodeId[];

  viewport: CameraViewport;
  grid: GridSettings;

  meta: {
    createdAt: number;
    updatedAt: number;
    lastModifiedBy?: string;
    version: number;
  };
}
