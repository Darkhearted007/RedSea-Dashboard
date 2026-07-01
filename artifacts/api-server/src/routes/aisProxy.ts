import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";

const API_KEY = process.env.VITE_AISSTREAM_API_KEY || "";
const AISSTREAM_URL = "wss://stream.aisstream.io/v0/stream";

export function attachAISProxy(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    const pathname = new URL(req.url || "/", `http://${req.headers.host}`).pathname;
    if (pathname !== "/api/ais-stream") {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (clientWs: WebSocket) => {
    if (!API_KEY) {
      clientWs.send(JSON.stringify({ error: "VITE_AISSTREAM_API_KEY not configured" }));
      clientWs.close();
      return;
    }

    const upstream = new WebSocket(AISSTREAM_URL);

    upstream.on("open", () => {
      upstream.send(
        JSON.stringify({
          APIKey: API_KEY,
          BoundingBoxes: [[[-90, -180], [90, 180]]],
          FilterMessageTypes: ["PositionReport", "ShipStaticData"],
        })
      );
    });

    upstream.on("message", (data: Buffer | string) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(typeof data === "string" ? data : data.toString("utf8"));
      }
    });

    upstream.on("close", () => {
      if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
    });
    upstream.on("error", () => {
      if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
    });
    clientWs.on("close", () => {
      if (upstream.readyState === WebSocket.OPEN) upstream.close();
    });
    clientWs.on("error", () => {
      if (upstream.readyState === WebSocket.OPEN) upstream.close();
    });
  });
}
