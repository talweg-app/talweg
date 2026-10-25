import { projectLibraryPlugin } from "./server/projectLibrary.js";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { WebSocketServer, WebSocket } from "ws";

function talwegSyncPlugin(): Plugin {
  return {
    name: "talweg-sync",
    configureServer(server) {
      const wss = new WebSocketServer({ noServer: true });
      const rooms = new Map<string, Set<WebSocket>>();
      const roomUpdates = new Map<string, Uint8Array[]>();

      server.httpServer?.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
        const reqUrl = typeof request.url === "string" ? request.url : "/";
        const url = new URL(reqUrl, "http://localhost");
        if (url.pathname === "/talweg-sync") {
          const roomId = url.searchParams.get("room") ?? "default";
          wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit("connection", ws, request, roomId);
          });
        }
      });

      wss.on("connection", (ws: WebSocket, _request: unknown, roomId: string) => {
        let room = rooms.get(roomId);
        if (!room) {
          room = new Set();
          rooms.set(roomId, room);
          roomUpdates.set(roomId, []);
        }
        room.add(ws);

        // Send existing room updates to newly connected client
        const history = roomUpdates.get(roomId);
        if (history && history.length > 0) {
          for (const update of history) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(update, { binary: true });
            }
          }
        }

        ws.on("message", (data: Buffer | ArrayBuffer, isBinary: boolean) => {
          const binaryData = data instanceof Buffer
            ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
            : new Uint8Array(data);

          // Save update in room history if it is a state or update packet (tag 1, 2, or untagged)
          if (binaryData.length > 0 && binaryData[0] !== 0) {
            const updates = roomUpdates.get(roomId);
            if (updates) {
              updates.push(binaryData);
              if (updates.length > 500) {
                updates.splice(0, updates.length - 200);
              }
            }
          }

          // Relay raw binary Yjs update packet to all other clients in the same room
          for (const client of room) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(binaryData, { binary: isBinary });
            }
          }
        });

        const handleClose = () => {
          room.delete(ws);
          if (room.size === 0) {
            rooms.delete(roomId);
            roomUpdates.delete(roomId);
          }
        };

        ws.on("close", handleClose);
        ws.on("error", handleClose);
      });
    },
  };
}

export default defineConfig({
  appType: "spa",
  plugins: [tailwindcss(), react(), talwegSyncPlugin(), ...(process.env.TALWEG_BROWSER_STORAGE_ONLY === "1" ? [] : [projectLibraryPlugin()])],
  server: {
    port: 5173,
    host: true,
  },
});
