# Deploying RedSea AI Platform to Vercel

This guide walks you through hosting the full RedSea AI Platform on Vercel
(frontend + REST API as a serverless function).

> **Note on WebSocket / AIS Proxy**  
> Vercel's serverless runtime does not support persistent WebSocket connections.
> The frontend automatically falls back to a **direct browser connection** to
> `aisstream.io` when the `/api/ais-stream` proxy is unavailable, so live
> vessel tracking still works end-to-end.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| [Vercel account](https://vercel.com) | Free tier is sufficient |
| pnpm 11.x | The workspace uses `minimumReleaseAge` (pnpm ≥ 10.16) and `allowBuilds` (pnpm 11). The `installCommand` in `vercel.json` installs the correct version automatically. |
| PostgreSQL database | Vercel Postgres, Supabase, Neon, or any external PG |
| AIS Stream API key | Free at [aisstream.io](https://aisstream.io) |

---

## 1 — Fork / push the repo to GitHub

Vercel deploys from a Git provider. Push this repository to GitHub, GitLab,
or Bitbucket.

---

## 2 — Create a new Vercel project

1. Go to **vercel.com → New Project**.
2. Import your repository.
3. Vercel auto-detects the `vercel.json` at the repo root — **no framework
   preset selection is needed**.
4. Leave **Root Directory** as the repository root (`.`).

---

## 3 — Set environment variables

In **Project Settings → Environment Variables**, add:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (e.g. `******host:5432/db?sslmode=require`) |
| `VITE_AISSTREAM_API_KEY` | ✅ | AIS Stream API key from aisstream.io |
| `VITE_SUPABASE_URL` | only if using Supabase | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | only if using Supabase | Supabase anon key |

> `PORT` and `BASE_PATH` are **not** needed on Vercel — they default to safe
> values automatically.

---

## 4 — Provision the database schema

Run the Drizzle migration against your production database from your local
machine (or CI):

```bash
pnpm --filter @workspace/db push
```

This pushes the Drizzle schema (vessel threat profiles, violation log, AIS
positions, etc.) to your database.

---

## 5 — Deploy

Click **Deploy** in the Vercel dashboard, or push a commit to trigger automatic
deployment.

Vercel will:
1. Install pnpm 11.5.2 and workspace dependencies (`npm install -g pnpm@11.5.2 && pnpm install --frozen-lockfile`).
2. Build the frontend (`pnpm --filter @workspace/redsea-dashboard build`).
3. Bundle the API serverless function (`api/index.ts`).
4. Serve static assets from `artifacts/redsea-dashboard/dist/`.
5. Route all `/api/*` requests to the serverless function.

---

## 6 — Verify the deployment

| URL | Expected result |
|---|---|
| `https://your-project.vercel.app/` | RedSea landing page |
| `https://your-project.vercel.app/dashboard` | Mission Control dashboard |
| `https://your-project.vercel.app/api/healthz` | `{"status":"ok"}` |
| `https://your-project.vercel.app/api/vessels` | JSON array of vessel threat profiles |

---

## Architecture on Vercel

```
Browser
  │
  ├─ GET /dashboard/*   ──►  Vercel Edge CDN  ──►  index.html (SPA)
  │
  ├─ GET /api/vessels   ──►  Serverless Function (api/index.ts)
  │                           └─ Express router  ──►  PostgreSQL
  │
  └─ WSS aisstream.io   ──►  Direct browser WebSocket (AIS live feed)
```

The Express API handles all `/api/*` REST endpoints.  
Live AIS data streams directly from `aisstream.io` to the browser.

---

## Custom domain

In **Vercel → Project → Domains**, add your custom domain and Vercel will
provision an SSL certificate automatically.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails: `Unknown field "minimumReleaseAge"` or `allowBuilds` | The `installCommand` pins pnpm to v11.5.2. If you've overridden `installCommand`, restore it to `npm install -g pnpm@11.5.2 && pnpm install --frozen-lockfile`. |
| Build fails: `DATABASE_URL must be set` | Add `DATABASE_URL` env var in Vercel dashboard |
| No vessels on map | Set `VITE_AISSTREAM_API_KEY` in Vercel dashboard |
| 404 on `/dashboard/*` routes | Ensure `vercel.json` is committed at the repo root |
| API returns 500 | Check function logs in **Vercel → Functions → View Logs** |
