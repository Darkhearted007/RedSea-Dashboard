---
name: Supabase migration complete
description: RedSea Ledger fully migrated from Supabase to Replit PostgreSQL. Key decisions and gotchas.
---

# Supabase → Replit PostgreSQL migration

## The rule
All Supabase reads/writes have been removed. Data flows through the API server exclusively. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are no longer required.

**Why:** The project was imported from GitHub with Supabase as the data layer. The mobile app was already partially migrated (using API server). This migration completed the remaining web frontend and API server routes.

**How to apply:** If Supabase imports reappear in the future, remove them and replace with fetch calls to /api/... endpoints.

## snake_case contract
Drizzle returns camelCase field names, but the frontend consumers (useSecureAISStream.ts, etc.) read snake_case keys (vessel_name, last_lat, threat_level, etc.). The API query routes in `artifacts/api-server/src/routes/queries.ts` and `vessels.ts` map Drizzle rows back to snake_case before responding.

**Why:** Avoids a sweeping rename across all frontend consumers.

**How to apply:** Any new read endpoint must map camelCase Drizzle fields to snake_case in the response.

## Key files changed
- `lib/db/src/schema/index.ts` — 6 tables (violationLog, vesselThreatProfiles, documentRegistry, portIntelligence, sanctionsHits, aisPositions)
- `artifacts/api-server/src/routes/persist.ts` — write endpoints using Drizzle
- `artifacts/api-server/src/routes/queries.ts` — read endpoints (snake_case output)
- `artifacts/api-server/src/routes/vessels.ts` — GET /api/vessels (snake_case output)
- `artifacts/redsea-dashboard/src/lib/supabase/persistence.ts` — all reads now call API
- `artifacts/redsea-dashboard/src/pages/HomePage.tsx` — API health check replaces Supabase check

## Remaining Supabase files (dead code)
- `artifacts/redsea-dashboard/src/lib/supabase/client.ts` — unused, safe to delete
- `artifacts/redsea-dashboard/src/lib/supabase/admin.ts` — unused, safe to delete
- `.migration-backup/` directory — original GitHub code, reference only
