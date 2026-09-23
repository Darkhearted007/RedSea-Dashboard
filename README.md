# RedSea Ledger — Maritime Intelligence Platform

> **Proprietary software. All rights reserved. See [LICENSE](./LICENSE) for terms.**

---

RedSea Ledger is a real-time maritime intelligence platform built for operators, analysts, and security teams that need actionable vessel intelligence in contested or high-risk maritime corridors. It combines live AIS vessel tracking, AI-driven threat detection, blockchain-style document verification, port OSINT, and sanction screening into a single unified dashboard.

---

## What it does

| Feature | Description |
|---|---|
| **Live Vessel Tracking** | WebSocket connection to aisstream.io — worldwide real-time AIS positions, continuously updated |
| **Vessel Trails** | Each vessel accumulates up to 200 in-memory position points; high-threat vessels leave visible trail marks on the map |
| **AI Threat Detection** | Multi-stage anomaly engine scores every vessel 0–100 across MMSI spoofing, GPS jumps, speed anomalies, exclusion-zone incursions, and dark-period gaps |
| **Sanction Screening** | Automatic cross-reference against OFAC, UN, EU, UK, and AU sanction lists on every vessel update |
| **Intelligence Reports** | One-click vessel panel: cargo class, draught load proxy, threat flags, sanction hits, destination, and 72-hour position history |
| **Document Verification** | Blockchain-style tamper chain for maritime documents — file hash registry, prior-hash linkage, and tamper confidence scoring |
| **Port OSINT** | Risk-rated port database with sanction regimes, congestion levels, incident history, and UN/LOCODE reference |
| **Persistent Storage** | All positions, threat profiles, violations, sanctions, and documents stored in a managed PostgreSQL database via Drizzle ORM |
| **Mobile Companion** | Expo React Native app with vessel list, tap-to-navigate vessel detail, and document scanner |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Client Layer                    │
│  React 19 + Vite (web)  │  Expo 54 (mobile)     │
└────────────┬────────────────────────┬────────────┘
             │                        │
             ▼                        ▼
┌─────────────────────────────────────────────────┐
│              API Server (Express 5)              │
│  /api/persist/*   /api/vessels   /api/ports      │
│  /api/violations  /api/sanctions /api/documents  │
│  /api/dashboard/stats  /api/ais-stream (WS)      │
└─────────────────────┬───────────────────────────┘
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
    PostgreSQL    aisstream.io  AI Engine
    (Drizzle ORM)  WebSocket   (local anomaly
     6 tables      live AIS     detection)
```

**Monorepo layout:**

```
artifacts/
  api-server/          Express 5 API + AIS WebSocket proxy
  redsea-dashboard/    React + Vite web dashboard
  redsea-dashboard-mobile/  Expo React Native mobile app
  mockup-sandbox/      Component preview server (dev only)
lib/
  db/                  Drizzle schema + Replit PostgreSQL client
  api-spec/            OpenAPI 3 spec (source of truth)
  api-client-react/    React Query hooks (Orval codegen)
  api-zod/             Zod validators (Orval codegen)
```

---

## Database schema

| Table | Purpose |
|---|---|
| `vessel_threat_profiles` | Latest threat state per MMSI — score, flags, last position |
| `ais_positions` | Rolling position log — every reported lat/lon/speed/heading |
| `violation_log` | Persisted anomaly events with severity and location |
| `document_registry` | Tamper-chain document records with hash linkage |
| `port_intelligence` | Port risk profiles — sanctions, congestion, incidents |
| `sanctions_hits` | Individual sanction matches by regime and list name |

---

## Quickstart

### Prerequisites

- Node.js 20+ and pnpm 9+
- Replit account (for managed PostgreSQL) **or** any PostgreSQL instance with `DATABASE_URL` set
- [aisstream.io](https://aisstream.io) API key (free tier available)

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AISSTREAM_API_KEY` | Yes | aisstream.io API key for live AIS data |
| `SESSION_SECRET` | Yes | Random string for session signing |

### Install and run

```bash
# Install all workspace dependencies
pnpm install

# Push database schema
pnpm --filter @workspace/db run push

# Start all services in parallel
pnpm --filter @workspace/api-server run dev     # API on :8080
pnpm --filter @workspace/redsea-dashboard run dev  # Web dashboard
pnpm --filter @workspace/redsea-dashboard-mobile run dev  # Expo mobile
```

### Regenerate API client (after changing openapi.yaml)

```bash
pnpm --filter @workspace/api-spec run codegen
```

### Seed demo data

```bash
pnpm --filter @workspace/db run seed   # (see Task #4 — sample ports and vessels)
```

---

## Technology stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24, TypeScript 5.9 |
| API | Express 5, Pino logger |
| Database | PostgreSQL + Drizzle ORM + drizzle-zod |
| Validation | Zod v4 |
| API spec | OpenAPI 3 → Orval codegen |
| Web | React 19, Vite 6, Tailwind CSS 4, Leaflet + react-leaflet |
| Mobile | Expo 54, Expo Router, React Native |
| Build | esbuild (API), Vite (web), Metro (mobile) |
| Package manager | pnpm workspaces |

---

## IP Notice

RedSea Ledger is **proprietary software**. The threat-scoring engine, anomaly detection algorithms, port risk database, tamper-chain document verification methodology, and data pipeline are proprietary intellectual property. Reverse engineering, decompilation, or derivative works are prohibited. See [LICENSE](./LICENSE).

---

## Monetisation

See [MONETISATION.md](./MONETISATION.md) for the full commercial strategy.

**Short version:**

| Tier | Target | Price signal |
|---|---|---|
| Analyst | Independent researchers, NGOs | $99–299/mo |
| Operator | Shipping companies, brokers | $999–2,499/mo |
| Enterprise | Port authorities, navies, insurers | Custom / $25k+ ACV |
| API | MarTech / data resellers | Usage-based |

---

## Licence

Proprietary. © 2024–2026. All rights reserved. See [LICENSE](./LICENSE).
