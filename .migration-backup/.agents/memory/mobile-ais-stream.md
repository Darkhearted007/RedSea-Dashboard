---
name: Mobile AIS stream WebSocket pattern
description: How the AIS stream is implemented in the mobile companion app
---

# Mobile AIS Stream

The mobile app uses the native `WebSocket` global (available in React Native/Hermes) to connect to AISStream.io.

**Key decisions:**
- Env var: `EXPO_PUBLIC_AISSTREAM_API_KEY` (not VITE_ prefix — Expo uses EXPO_PUBLIC_)
- Connection URL: `wss://stream.aisstream.io/v0/stream`
- Subscribe message: `{ APIKey, BoundingBoxes: [[[-90,-180],[90,180]]], FilterMessageTypes: ["PositionReport"] }`
- Context: `context/AISContext.tsx` — provides vessels, threatProfiles, violations, connectionStatus, stats
- Graceful empty state when key is missing: `connectionStatus === "no_key"` shows informational message
- Auto-reconnect: 5s timeout on close

**Why:** Mode B (no @workspace/api-client-react) — direct WebSocket + React context mirrors the web app's useSecureAISStream hook pattern but adapted for React Native.

**How to apply:** When extending or debugging the vessel data layer in the mobile app.
