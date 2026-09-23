/**
 * Vercel Serverless Function — RedSea AI Platform API
 *
 * Wraps the existing Express application as a single catch-all Vercel function.
 * All requests matching /api/* are routed here by vercel.json.
 *
 * Note: The AIS WebSocket proxy (attachAISProxy) cannot run in a serverless
 * environment — the frontend automatically falls back to a direct WebSocket
 * connection to aisstream.io when the proxy is unavailable.
 *
 * Required environment variables (set in Vercel dashboard):
 *   DATABASE_URL          — PostgreSQL connection string
 *   AISSTREAM_API_KEY — AIS stream API key (also used server-side by the proxy)
 */

import type { IncomingMessage, ServerResponse } from "node:http"
import app from "../artifacts/api-server/src/app"

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  // Express 5 application is a standard Node.js request handler.
  // vercel.json rewrites preserve the original URL so Express routing works as-is.
  app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1], () => {
    res.statusCode = 404
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({ error: "API route not found" }))
  })
}
