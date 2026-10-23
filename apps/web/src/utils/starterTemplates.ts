import type {
  ArrowNode,
  CanvasDocument,
  CanvasNode,
  CapsuleNode,
  CylinderNode,
  DiamondNode,
  DocumentId,
  NodeId,
  RectangleNode,
} from "@talweg/core";
import { createId } from "./template.js";

export function createBlankCanvas(id = `doc-${crypto.randomUUID().slice(0, 8)}`): CanvasDocument {
  const timestamp = Date.now();
  const documentId = id as DocumentId;

  return {
    id: documentId,
    name: "Blank Canvas",
    schemaVersion: 1,
    nodes: {},
    rootNodeIds: [],
    viewport: { x: 0, y: 0, zoom: 1.0 },
    grid: { enabled: true, size: 24, snapToGrid: false, gridType: "dots" },
    meta: {
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
    },
  };
}

export function createMicroservicesTemplate(id = `doc-${crypto.randomUUID().slice(0, 8)}`): CanvasDocument {
  const timestamp = Date.now();
  const documentId = id as DocumentId;

  const gatewayId = createId("rect");
  const authId = createId("rect");
  const ordersId = createId("rect");
  const paymentId = createId("diamond");
  const eventStreamId = createId("capsule");
  const dbId = createId("cylinder");

  const edge1Id = createId("arrow");
  const edge2Id = createId("arrow");
  const edge3Id = createId("arrow");
  const edge4Id = createId("arrow");
  const edge5Id = createId("arrow");

  const gateway: RectangleNode = {
    id: gatewayId,
    type: "rectangle",
    x: 80,
    y: 200,
    width: 200,
    height: 80,
    rotation: 0,
    zIndex: 1,
    opacity: 1,
    parentId: null,
    isLocked: false,
    isVisible: true,
    style: {
      fillColor: "#0f141c",
      strokeColor: "#38bdf8",
      strokeWidth: 1.5,
      cornerRadius: 6,
      textColor: "#f0f9ff",
      fontSize: 13,
      fontWeight: 500,
      textAlign: "center",
      verticalAlign: "middle",
    },
    data: { label: "API Gateway\n(Reverse Proxy)" },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const auth: RectangleNode = {
    id: authId,
    type: "rectangle",
    x: 352,
    y: 96,
    width: 200,
    height: 80,
    rotation: 0,
    zIndex: 2,
    opacity: 1,
    parentId: null,
    isLocked: false,
    isVisible: true,
    style: {
      fillColor: "#0f141c",
      strokeColor: "#818cf8",
      strokeWidth: 1,
      cornerRadius: 6,
      textColor: "#e0e7ff",
      fontSize: 13,
      fontWeight: 500,
      textAlign: "center",
      verticalAlign: "middle",
    },
    data: { label: "Auth Service\n(JWT / OAuth)" },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const orders: RectangleNode = {
    id: ordersId,
    type: "rectangle",
    x: 352,
    y: 304,
    width: 200,
    height: 80,
    rotation: 0,
    zIndex: 3,
    opacity: 1,
    parentId: null,
    isLocked: false,
    isVisible: true,
    style: {
      fillColor: "#0f141c",
      strokeColor: "#34d399",
      strokeWidth: 1,
      cornerRadius: 6,
      textColor: "#ecfdf5",
      fontSize: 13,
      fontWeight: 500,
      textAlign: "center",
      verticalAlign: "middle",
    },
    data: { label: "Order Engine\n(State Machine)" },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const payment: DiamondNode = {
    id: paymentId,
    type: "diamond",
    x: 624,
    y: 296,
    width: 144,
    height: 96,
    rotation: 0,
    zIndex: 4,
    opacity: 1,
    parentId: null,
    isLocked: false,
    isVisible: true,
    style: {
      fillColor: "#17122a",
      strokeColor: "#a855f7",
      strokeWidth: 1.5,
      textColor: "#f3e8ff",
      fontSize: 12,
    },
    data: { label: "Payment\nApproved?" },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const eventStream: CapsuleNode = {
    id: eventStreamId,
    type: "capsule",
    x: 624,
    y: 112,
    width: 160,
    height: 48,
    rotation: 0,
    zIndex: 5,
    opacity: 1,
    parentId: null,
    isLocked: false,
    isVisible: true,
    style: {
      fillColor: "#052e16",
      strokeColor: "#22c55e",
      strokeWidth: 1.5,
      textColor: "#bbf7d0",
      fontSize: 12,
    },
    data: { label: "Event Stream" },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const db: CylinderNode = {
    id: dbId,
    type: "cylinder",
    x: 880,
    y: 296,
    width: 144,
    height: 96,
    rotation: 0,
    zIndex: 6,
    opacity: 1,
    parentId: null,
    isLocked: false,
    isVisible: true,
    style: {
      fillColor: "#1e1329",
      strokeColor: "#c084fc",
      strokeWidth: 1.5,
      textColor: "#f5d0fe",
      fontSize: 12,
    },
    data: { label: "Orders Database\n(PostgreSQL)" },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

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
    style: { strokeColor: "#38bdf8", strokeWidth: 1.5 },
    data: { sourceId: gatewayId, targetId: authId, sourceAnchor: "e", targetAnchor: "w", endArrow: "arrow", label: "/auth" },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

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
    style: { strokeColor: "#38bdf8", strokeWidth: 1.5 },
    data: { sourceId: gatewayId, targetId: ordersId, sourceAnchor: "e", targetAnchor: "w", endArrow: "arrow", label: "/checkout" },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const edge3: ArrowNode = {
    id: edge3Id,
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
    style: { strokeColor: "#34d399", strokeWidth: 1.5 },
    data: { sourceId: ordersId, targetId: paymentId, sourceAnchor: "e", targetAnchor: "w", endArrow: "arrow" },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const edge4: ArrowNode = {
    id: edge4Id,
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
    style: { strokeColor: "#a855f7", strokeWidth: 1.5 },
    data: { sourceId: paymentId, targetId: dbId, sourceAnchor: "e", targetAnchor: "w", endArrow: "arrow", label: "Commit" },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const edge5: ArrowNode = {
    id: edge5Id,
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
    style: { strokeColor: "#818cf8", strokeWidth: 1.5 },
    data: { sourceId: authId, targetId: eventStreamId, sourceAnchor: "e", targetAnchor: "w", endArrow: "arrow", label: "UserEvents" },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const nodes: Record<NodeId, CanvasNode> = {
    [gatewayId]: gateway,
    [authId]: auth,
    [ordersId]: orders,
    [paymentId]: payment,
    [eventStreamId]: eventStream,
    [dbId]: db,
    [edge1Id]: edge1,
    [edge2Id]: edge2,
    [edge3Id]: edge3,
    [edge4Id]: edge4,
    [edge5Id]: edge5,
  };

  return {
    id: documentId,
    name: "Microservices Architecture",
    schemaVersion: 1,
    nodes,
    rootNodeIds: [gatewayId, authId, ordersId, paymentId, eventStreamId, dbId],
    viewport: { x: 40, y: 40, zoom: 0.95 },
    grid: { enabled: true, size: 16, snapToGrid: true, gridType: "dots" },
    meta: {
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
    },
  };
}

export function createSprintMindmapTemplate(id = `doc-${crypto.randomUUID().slice(0, 8)}`): CanvasDocument {
  const timestamp = Date.now();
  const documentId = id as DocumentId;

  const rootId = createId("root");
  const branch1Id = createId("node");
  const branch2Id = createId("node");
  const branch3Id = createId("node");
  const sub1Id = createId("node");
  const sub2Id = createId("node");

  const edge1Id = createId("arrow");
  const edge2Id = createId("arrow");
  const edge3Id = createId("arrow");
  const edge4Id = createId("arrow");
  const edge5Id = createId("arrow");

  const root: RectangleNode = {
    id: rootId,
    type: "rectangle",
    x: 80,
    y: 220,
    width: 160,
    height: 52,
    rotation: 0,
    zIndex: 1,
    opacity: 1,
    parentId: null,
    isLocked: false,
    isVisible: true,
    style: {
      fillColor: "#0f172a",
      strokeColor: "#38bdf8",
      strokeWidth: 2,
      cornerRadius: 6,
      textColor: "#f8fafc",
      fontSize: 14,
      fontWeight: 600,
      textAlign: "center",
      verticalAlign: "middle",
    },
    data: { label: "Sprint 42 Goals" },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const branch1: RectangleNode = {
    id: branch1Id,
    type: "rectangle",
    x: 360,
    y: 120,
    width: 150,
    height: 44,
    rotation: 0,
    zIndex: 2,
    opacity: 1,
    parentId: null,
    isLocked: false,
    isVisible: true,
    style: {
      fillColor: "#0f141c",
      strokeColor: "#818cf8",
      strokeWidth: 1,
      cornerRadius: 6,
      textColor: "#f4f4f5",
      fontSize: 12,
      textAlign: "center",
      verticalAlign: "middle",
    },
    data: { label: "User Experience" },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const branch2: RectangleNode = {
    id: branch2Id,
    type: "rectangle",
    x: 360,
    y: 224,
    width: 150,
    height: 44,
    rotation: 0,
    zIndex: 3,
    opacity: 1,
    parentId: null,
    isLocked: false,
    isVisible: true,
    style: {
      fillColor: "#0f141c",
      strokeColor: "#818cf8",
      strokeWidth: 1,
      cornerRadius: 6,
      textColor: "#f4f4f5",
      fontSize: 12,
      textAlign: "center",
      verticalAlign: "middle",
    },
    data: { label: "Core Engine" },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const branch3: RectangleNode = {
    id: branch3Id,
    type: "rectangle",
    x: 360,
    y: 328,
    width: 150,
    height: 44,
    rotation: 0,
    zIndex: 4,
    opacity: 1,
    parentId: null,
    isLocked: false,
    isVisible: true,
    style: {
      fillColor: "#0f141c",
      strokeColor: "#818cf8",
      strokeWidth: 1,
      cornerRadius: 6,
      textColor: "#f4f4f5",
      fontSize: 12,
      textAlign: "center",
      verticalAlign: "middle",
    },
    data: { label: "Infra & Storage" },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const sub1: RectangleNode = {
    id: sub1Id,
    type: "rectangle",
    x: 620,
    y: 96,
    width: 140,
    height: 40,
    rotation: 0,
    zIndex: 5,
    opacity: 1,
    parentId: null,
    isLocked: false,
    isVisible: true,
    style: {
      fillColor: "#0f141c",
      strokeColor: "#64748b",
      strokeWidth: 1,
      cornerRadius: 6,
      textColor: "#cbd5e1",
      fontSize: 11,
      textAlign: "center",
      verticalAlign: "middle",
    },
    data: { label: "Linear Aesthetic" },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const sub2: RectangleNode = {
    id: sub2Id,
    type: "rectangle",
    x: 620,
    y: 152,
    width: 140,
    height: 40,
    rotation: 0,
    zIndex: 6,
    opacity: 1,
    parentId: null,
    isLocked: false,
    isVisible: true,
    style: {
      fillColor: "#0f141c",
      strokeColor: "#64748b",
      strokeWidth: 1,
      cornerRadius: 6,
      textColor: "#cbd5e1",
      fontSize: 11,
      textAlign: "center",
      verticalAlign: "middle",
    },
    data: { label: "Touchpad Panning" },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

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
    style: { strokeColor: "#818cf8", strokeWidth: 1.5 },
    data: { sourceId: rootId, targetId: branch1Id, curveStyle: "bezier", startArrow: "none", endArrow: "none" },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

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
    style: { strokeColor: "#818cf8", strokeWidth: 1.5 },
    data: { sourceId: rootId, targetId: branch2Id, curveStyle: "bezier", startArrow: "none", endArrow: "none" },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const edge3: ArrowNode = {
    id: edge3Id,
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
    style: { strokeColor: "#818cf8", strokeWidth: 1.5 },
    data: { sourceId: rootId, targetId: branch3Id, curveStyle: "bezier", startArrow: "none", endArrow: "none" },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const edge4: ArrowNode = {
    id: edge4Id,
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
    style: { strokeColor: "#64748b", strokeWidth: 1 },
    data: { sourceId: branch1Id, targetId: sub1Id, curveStyle: "bezier", startArrow: "none", endArrow: "none" },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const edge5: ArrowNode = {
    id: edge5Id,
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
    style: { strokeColor: "#64748b", strokeWidth: 1 },
    data: { sourceId: branch1Id, targetId: sub2Id, curveStyle: "bezier", startArrow: "none", endArrow: "none" },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const nodes: Record<NodeId, CanvasNode> = {
    [rootId]: root,
    [branch1Id]: branch1,
    [branch2Id]: branch2,
    [branch3Id]: branch3,
    [sub1Id]: sub1,
    [sub2Id]: sub2,
    [edge1Id]: edge1,
    [edge2Id]: edge2,
    [edge3Id]: edge3,
    [edge4Id]: edge4,
    [edge5Id]: edge5,
  };

  return {
    id: documentId,
    name: "Sprint Planning Mindmap",
    schemaVersion: 1,
    nodes,
    rootNodeIds: [rootId, branch1Id, branch2Id, branch3Id, sub1Id, sub2Id],
    viewport: { x: 50, y: 50, zoom: 1.0 },
    grid: { enabled: true, size: 24, snapToGrid: false, gridType: "dots" },
    meta: {
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
    },
  };
}
