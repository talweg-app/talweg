import type { IncomingMessage, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";

export function peerSignalingPlugin(): Plugin {
  const attach = (server: ViteDevServer | PreviewServer) => {
    const send = (socket: WebSocket, packet: unknown) => {
      if (socket.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify(packet));
    };
    server.middlewares.use(
      "/api/peer-config",
      (_request: IncomingMessage, response: ServerResponse) => {
        response.setHeader("Content-Type", "application/json");
        response.setHeader("Cache-Control", "no-store");
        response.end(
          JSON.stringify({
            iceServers: JSON.parse(
              process.env.TALWEG_ICE_SERVERS ?? "[]",
            ) as unknown,
            localRelay: process.env.TALWEG_BROWSER_STORAGE_ONLY === "1",
          }),
        );
      },
    );
    const relay = new WebSocketServer({
      noServer: true,
      maxPayload: 128 * 1024,
    });
    const topics = new Map<string, Set<WebSocket>>();
    server.httpServer?.on(
      "upgrade",
      (request: IncomingMessage, socket: Duplex, head: Buffer) => {
        if (
          new URL(request.url ?? "/", "http://localhost").pathname !==
          "/talweg-relay"
        )
          return;
        relay.handleUpgrade(request, socket, head, (client) => {
          relay.emit("connection", client);
        });
      },
    );
    relay.on("connection", (client: WebSocket) => {
      const subscriptions = new Set<string>();
      const unsubscribe = (topic: string) => {
        subscriptions.delete(topic);
        const peers = topics.get(topic);
        peers?.delete(client);
        if (!peers?.size) topics.delete(topic);
      };
      client.on("message", (bytes) => {
        try {
          const packet = JSON.parse(
            (Buffer.isBuffer(bytes)
              ? bytes
              : Array.isArray(bytes)
                ? Buffer.concat(bytes)
                : Buffer.from(bytes)
            ).toString("utf8"),
          ) as { type: string; topic: string; payload?: unknown };
          if (typeof packet.topic !== "string" || packet.topic.length > 256)
            throw new Error("Invalid topic");
          if (packet.type === "subscribe") {
            if (subscriptions.size >= 32)
              throw new Error("Too many subscriptions");
            const peers = topics.get(packet.topic) ?? new Set<WebSocket>();
            peers.add(client);
            topics.set(packet.topic, peers);
            subscriptions.add(packet.topic);
          } else if (packet.type === "unsubscribe") unsubscribe(packet.topic);
          else if (packet.type === "publish")
            for (const recipient of topics.get(packet.topic) ?? [])
              if (recipient !== client)
                send(recipient, {
                  topic: packet.topic,
                  payload: packet.payload,
                });
        } catch {
          client.close(1008);
        }
      });
      client.on("close", () => {
        for (const topic of subscriptions) unsubscribe(topic);
      });
      client.on("error", () => {
        client.close();
      });
    });
    server.httpServer?.once("close", () => {
      for (const client of relay.clients) client.terminate();
      relay.close();
    });
  };
  return {
    name: "talweg-peer-signaling",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
