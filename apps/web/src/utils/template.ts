import type {
  ArrowNode,
  CanvasDocument,
  CanvasNode,
  CapsuleNode,
  CylinderNode,
  DocumentId,
  NodeId,
  RectangleNode,
  StickerNode,
} from "@talweg/core";

export function createId(prefix = "node"): NodeId {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}` as NodeId;
}

export function createInitialScene(documentId = "default-doc"): CanvasDocument {
  const timestamp = 1700000000000;

  const gatewayId = `${documentId}-gateway` as NodeId;
  const authId = `${documentId}-auth` as NodeId;
  const dbId = `${documentId}-db` as NodeId;
  const welcomeNoteId = `${documentId}-welcome-note` as NodeId;
  const edge1Id = `${documentId}-edge-gateway-auth` as NodeId;
  const edge2Id = `${documentId}-edge-auth-db` as NodeId;

  // Tier 1: API Gateway (Terminator capsule, emerald styling, status online)
  const gateway: CapsuleNode = {
    id: gatewayId,
    type: "capsule",
    x: 80,
    y: 160,
    width: 176,
    height: 52,
    rotation: 0,
    zIndex: 1,
    opacity: 1,
    parentId: null,
    isLocked: false,
    isVisible: true,
    style: {
      fillColor: "#062b1e",
      strokeColor: "#10b981",
      strokeWidth: 1.5,
      textColor: "#a7f3d0",
      fontSize: 12,
    },
    data: {
      label: "API Gateway\n(online)",
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  // Tier 2: Auth Service (Process rectangle, sky styling)
  const auth: RectangleNode = {
    id: authId,
    type: "rectangle",
    x: 360,
    y: 146,
    width: 200,
    height: 80,
    rotation: 0,
    zIndex: 2,
    opacity: 1,
    parentId: null,
    isLocked: false,
    isVisible: true,
    style: {
      fillColor: "#0f172a",
      strokeColor: "#38bdf8",
      strokeWidth: 1.5,
      cornerRadius: 6,
      textColor: "#e0f2fe",
      fontSize: 13,
      fontWeight: 500,
      textAlign: "center",
      verticalAlign: "middle",
    },
    data: {
      label: "Auth Service",
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  // Tier 3: Primary PostgreSQL (Data cylinder, purple styling)
  const db: CylinderNode = {
    id: dbId,
    type: "cylinder",
    x: 660,
    y: 138,
    width: 176,
    height: 96,
    rotation: 0,
    zIndex: 3,
    opacity: 1,
    parentId: null,
    isLocked: false,
    isVisible: true,
    style: {
      fillColor: "#181126",
      strokeColor: "#a855f7",
      strokeWidth: 1.5,
      textColor: "#f3e8ff",
      fontSize: 12,
    },
    data: {
      label: "Primary PostgreSQL",
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  // Welcome Note: Butter muted palette, crisp typography
  const welcomeNote: StickerNode = {
    id: welcomeNoteId,
    type: "sticker",
    x: 80,
    y: 280,
    width: 240,
    height: 190,
    rotation: 0,
    zIndex: 4,
    opacity: 1,
    parentId: null,
    isLocked: false,
    isVisible: true,
    style: {
      fillColor: "#fef9c3",
      textColor: "#422006",
      fontSize: 14,
      fontFamily: "sans-serif",
      cornerRadius: 4,
    },
    data: {
      content: "Talweg Architecture:\n\n• 3-tier distributed cloud\n• Real-time P2P room sync\n• Local-first CRDT state persistence",
      stickerShape: "square",
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  // 90° Orthogonal Connector 1: API Gateway -> Auth Service
  const edge1: ArrowNode = {
    id: edge1Id,
    type: "arrow",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0,
    zIndex: 10,
    opacity: 1,
    parentId: null,
    isLocked: false,
    isVisible: true,
    style: {
      strokeColor: "#38bdf8",
      strokeWidth: 1.5,
    },
    data: {
      sourceId: gatewayId,
      targetId: authId,
      sourceAnchor: "e",
      targetAnchor: "w",
      startArrow: "none",
      endArrow: "arrow",
      curveStyle: "orthogonal",
      label: "HTTPS / TLS",
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  // 90° Orthogonal Connector 2: Auth Service -> Primary PostgreSQL
  const edge2: ArrowNode = {
    id: edge2Id,
    type: "arrow",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0,
    zIndex: 10,
    opacity: 1,
    parentId: null,
    isLocked: false,
    isVisible: true,
    style: {
      strokeColor: "#a855f7",
      strokeWidth: 1.5,
    },
    data: {
      sourceId: authId,
      targetId: dbId,
      sourceAnchor: "e",
      targetAnchor: "w",
      startArrow: "none",
      endArrow: "arrow",
      curveStyle: "orthogonal",
      label: "Connection Pool",
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const nodes: Record<NodeId, CanvasNode> = {
    [gatewayId]: gateway,
    [authId]: auth,
    [dbId]: db,
    [welcomeNoteId]: welcomeNote,
    [edge1Id]: edge1,
    [edge2Id]: edge2,
  };

  const rootNodeIds: NodeId[] = [
    gatewayId,
    authId,
    dbId,
    welcomeNoteId,
    edge1Id,
    edge2Id,
  ];

  return {
    id: documentId as DocumentId,
    schemaVersion: 1,
    name: "Talweg Canvas",
    nodes,
    rootNodeIds,
    viewport: {
      x: 60,
      y: 40,
      zoom: 1.0,
    },
    grid: {
      enabled: true,
      size: 24,
      snapToGrid: false,
      gridType: "dots",
    },
    meta: {
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
    },
  };
}
