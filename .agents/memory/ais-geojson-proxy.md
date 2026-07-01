---
name: AIS GeoJSON map + WebSocket proxy
description: How the AIS stream and Mapbox map are architected after the article-driven rewrite
---

## WebSocket Proxy
- Browser connects to `/api/ais-stream` (same origin) via WebSocket
- api-server `attachAISProxy(server)` wired in `index.ts` after `app.listen()` returns the http.Server
- Proxy bridges to `wss://stream.aisstream.io/v0/stream`, injects API key server-side, subscribes to both `PositionReport` + `ShipStaticData`
- Frontend falls back to direct connection after 4s timeout if proxy fails

**Why:** aisstream.io uses HTTP/2 for WS upgrade which breaks in some browsers; API key stays server-side

## GeoJSON Map Layers
- Source: `geojson` type on source `"vessels"`, updated via `source.setData()` every 200ms
- Layer `vessels-glow`: blurred circle for HIGH/CRITICAL threat glow
- Layer `vessels-circle`: vessel position, color = vessel type, stroke = threat color
- Layer `vessels-heading`: symbol with custom SDF arrow (`vessel-arrow` image), rotates by heading, minzoom 4
- Layer `vessels-label`: text label at minzoom 7

**Why:** Individual DOM markers destroy performance at 10k+ vessels; GPU rendering via GeoJSON handles it

## Vessel Type → Color
- TANKER: #ff5500, CARGO: #00dd88, PASSENGER: #aa44ff, CONTAINER: #0099ff
- FISHING: #ffcc00, MILITARY: #ff0033, TUG: #ff9900, SAR: #00ffff, OTHER: #4a7090
- Parsed from AIS `ShipStaticData.TypeOfShipAndCargoType` (int 0-99)

## MMSI Country (MID codes)
- `mmsiToCountry(mmsi)` in `src/lib/ais/midCodes.ts` — first 3 digits → country name
- 300+ countries in MID_CODES lookup

## Filter Panel
- Floating panel on the map (bottom-left), toggled by Filters button
- Vessel type checkboxes, min speed slider (0-25 kn), flag country dropdown
- Country dropdown dynamically populated from vessels in current store
