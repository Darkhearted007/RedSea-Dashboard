# RedSea Ledger

Real-time maritime intelligence platform — AIS vessel tracking, threat detection, port OSINT, and blockchain document verification.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/redsea-dashboard run dev` — run the web dashboard
- `pnpm --filter @workspace/redsea-dashboard-mobile run dev` — run the Expo mobile app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Replit-managed Postgres (auto-provided, do NOT set manually)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, port 8080 (preview path `/api`)
- DB: Replit PostgreSQL + Drizzle ORM (schema in `lib/db/src/schema/index.ts`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)
- Build: esbuild (CJS bundle)
- Web: React 19 + Vite + Tailwind CSS 4, Leaflet maps (preview path `/`)
- Mobile: Expo 54 + React Native, Expo Router (preview path `/mobile/`)

## Where things live

- `lib/db/src/schema/index.ts` — source of truth for DB schema (6 tables)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `artifacts/api-server/src/routes/` — API routes:
  - `persist.ts` — write endpoints (violations, threat profiles, documents, positions, sanctions)
  - `queries.ts` — read endpoints (all returns snake_case to match frontend contract)
  - `vessels.ts` — `GET /api/vessels` (list all vessel threat profiles)
  - `health.ts` — `GET /api/healthz`
- `artifacts/redsea-dashboard/src/lib/supabase/persistence.ts` — web persistence layer (all calls go to API server, no direct DB)
- `artifacts/redsea-dashboard-mobile/lib/persistence.ts` — mobile persistence layer (calls API server)
- `.migration-backup/` — original GitHub code before Replit migration (read-only reference)

## Architecture decisions

- **No direct Supabase access**: Originally used Supabase; fully migrated to Replit PostgreSQL. All data reads/writes go through the API server. The `supabase/` folder in the web app remains as a namespace (not the service).
- **snake_case API contract**: API query routes map Drizzle camelCase back to snake_case to match the existing frontend consumers without requiring changes throughout.
- **Mobile uses API server only**: Mobile app has no direct DB access; all persistence via `https://${EXPO_PUBLIC_DOMAIN}/api/...`.
- **AIS stream requires key**: Live vessel tracking needs `AISSTREAM_API_KEY` (aisstream.io). Without it the map shows 0 vessels but loads correctly.
- **`.migration-backup/` workflows fail intentionally**: These are the original pre-migration files; their workflows point to the wrong workspace paths.

## Product

- **Home** — system status (Frontend, API, AIS Stream, AI Engine) + nav to dashboard sections
- **Overview** — fleet threat distribution, top threat vessels, security violation log
- **Live Vessels** — Leaflet map with real-time AIS vessel positions and threat overlays
- **Port Intel** — port intelligence and risk levels
- **Documents** — blockchain-style tamper detection for maritime documents
- **Mobile** — Expo app with vessel list, tap-to-navigate vessel detail, and document scanner

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `DATABASE_URL` is runtime-managed by Replit — never set it manually in secrets
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are no longer needed (migration complete)
- After schema changes: run `pnpm --filter @workspace/db run push` before restarting the API server
- The API server rebuilds on every `dev` restart (esbuild); allow ~10s for the build to finish

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
