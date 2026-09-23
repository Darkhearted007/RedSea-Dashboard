import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";

const API_KEY = process.env.AISSTREAM_API_KEY || "";
const AISSTREAM_URL = "wss://stream.aisstream.io/v0/stream";
const MAX_CONNECTIONS_TOTAL = 50;
const MAX_CONNECTIONS_PER_IP = 5;
const CLIENT_IDLE_TIMEOUT_MS = 15 * 60_000;
const ALLOWED_ORIGINS = new Set(
  (process.env.REDSEA_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

const connectionsByIp = new Map<string, number>();
let activeConnections = 0;

function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function originAllowed(req: IncomingMessage): boolean {
  if (ALLOWED_ORIGINS.size === 0) {
    // Local development only. Production must set an explicit origin allowlist.
    return process.env.NODE_ENV !== "production";
  }
  const origin = req.headers.origin;
  return typeof origin === "string" && ALLOWED_ORIGINS.has(origin);
}

function releaseConnection(ip: string): void {
  activeConnections = Math.max(0, activeConnections - 1);
  const count = Math.max(0, (connectionsByIp.get(ip) || 1) - 1);
  if (count === 0) connectionsByIp.delete(ip);
  else connectionsByIp.set(ip, count);
}

export function attachAISProxy(server: Server): void {
  const wss = new WebSocketServer({ noServer: true, clientTracking: false });

  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    let pathname = "/";
    try {
      pathname = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`).pathname;
    } catch {
      socket.destroy();
      return;
    }

    if (pathname !== "/api/ais-stream") {
      socket.destroy();
      return;
    }

    if (!originAllowed(req)) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    const ip = getClientIp(req);
    const ipCount = connectionsByIp.get(ip) || 0;
    if (activeConnections >= MAX_CONNECTIONS_TOTAL || ipCount >= MAX_CONNECTIONS_PER_IP) {
      socket.write("HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    activeConnections += 1;
    connectionsByIp.set(ip, ipCount + 1);

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, ip);
    });
  });

  wss.on("connection", (clientWs: WebSocket, req: IncomingMessage, ip: string) => {
    if (!API_KEY) {
      clientWs.close(1011, "AIS service unavailable");
      releaseConnection(ip);
      return;
    }

    const upstream = new WebSocket(AISSTREAM_URL);
    const idleTimer = setTimeout(() => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(1000, "connection rotation");
      }
    }, CLIENT_IDLE_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(idleTimer);
      if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
        upstream.close();
      }
      releaseConnection(ip);
    };

    upstream.on("open", () => {
      upstream.send(
        JSON.stringify({
          APIKey: API_KEY,
          BoundingBoxes: [
            [[-2, 25], [32, 80]],
            [[-15, 38], [2, 60]],
            [[-5, -25], [25, 15]],
            [[25, -80], [65, 15]],
            [[-55, -70], [5, 20]],
            [[10, -100], [32, -60]],
          ],
          FilterMessageTypes: ["PositionReport", "ShipStaticData"],
        }),
      );
    });

    upstream.on("message", (data: Buffer | string) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        const payload = typeof data === "string" ? data : data.toString("utf8");
        if (Buffer.byteLength(payload, "utf8") <= 1_048_576) {
          clientWs.send(payload);
        }
      }
    });

    upstream.on("close", () => {
      if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
      cleanup();
    });

    upstream.on("error", () => {
      if (clientWs.readyState === WebSocket.OPEN) clientWs.close(1011, "upstream unavailable");
      cleanup();
    });

    clientWs.on("close", cleanup);
    clientWs.on("error", cleanup);

    // The browser should not be able to send arbitrary payloads into the upstream feed.
    clientWs.on("message", () => {
      clientWs.close(1008, "client messages are not permitted");
    });

    // Touching the socket is not enough to bypass the connection lifetime cap.
    void req;
  });
}
