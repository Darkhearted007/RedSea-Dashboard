# RedSea Ledger

A maritime intelligence dashboard that tracks vessels via AIS stream, performs threat detection, port OSINT, and document tamper verification.

## Run & Operate

- `pnpm --filter @workspace/redsea-dashboard run dev` — run the frontend (port 18235)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (artifact: `artifacts/redsea-dashboard`)
- API: Express 5 (artifact: `artifacts/api-server`)
- Routing: wouter (client-side)
- Map: Mapbox GL JS
- Realtime: AISStream WebSocket
- Persistence: Supabase (PostgreSQL)
- State: Zustand stores (`useVesselStore`, `useSecurityStore`)

## Where things live

- `artifacts/redsea-dashboard/src/pages/` — all 6 page components
- `artifacts/redsea-dashboard/src/components/maps/AISMap.tsx` — Mapbox vessel map
- `artifacts/redsea-dashboard/src/lib/supabase/persistence.ts` — all DB read/write logic
- `artifacts/redsea-dashboard/src/lib/security/aisAnomalyDetector.ts` — threat scoring engine
- `artifacts/redsea-dashboard/src/lib/security/documentTamperDetector.ts` — document hash+analysis
- `artifacts/redsea-dashboard/src/lib/intelligence/portIntelligence.ts` — port OSINT + sanctions
- `artifacts/redsea-dashboard/src/hooks/useSecureAISStream.ts` — AISStream WebSocket hook
- `artifacts/api-server/src/routes/persist.ts` — Express routes for all persist/* endpoints

## Architecture decisions

- Next.js API routes extracted to Express `api-server`; frontend uses `/api/persist/*` endpoints
- Supabase client uses placeholder credentials when env vars missing — app stays functional without crashing
- Mapbox map wrapped in error boundary + `useState` error catch — fails gracefully with friendly placeholder
- Service role key never exposed in frontend — all admin writes go through `api-server`
- Client-side reads still use Supabase anon key directly (read-only, safe)

## Product

- **Live Vessels** — real-time AIS map with colour-coded threat levels (CLEAN → CRITICAL)
- **Overview** — fleet threat summary, violation log, distribution chart
- **Port Intelligence** — port risk profiles for Red Sea / African ports, sanctions screening
- **Document Verification** — SHA-256 tamper detection for bills of lading, manifests, crew lists

## Required Secrets

| Secret | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (used only by api-server) |
| `VITE_AISSTREAM_API_KEY` | AISStream.io WebSocket key |
| `VITE_MAPBOX_TOKEN` | Mapbox GL token |

## Gotchas

- `VITE_` prefix required for all frontend env vars (Vite requirement)
- `VITE_SUPABASE_SERVICE_ROLE_KEY` is read by `api-server` via `process.env` — also needs to be set in the environment
- Mapbox WebGL fails in headless/screenshot environments — always wrapped in error boundary
- Removed `next` package dependency; all Next.js API routes migrated to `artifacts/api-server/`

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
