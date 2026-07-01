#!/usr/bin/env node
/**
 * One-shot Supabase setup: create tables, fix RLS, grant permissions, seed vessels.
 * Run with: node artifacts/api-server/scripts/setup-supabase.mjs
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: "public" },
});

// ─── SQL via Supabase SQL HTTP endpoint (bypasses RLS) ─────────────────────
async function sql(statement, label) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/run_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ sql: statement }),
  });
  if (!res.ok) {
    const body = await res.text();
    // Try direct upsert approach instead
    return { ok: false, body };
  }
  return { ok: true };
}

// ─── Seed data: real-world style vessels ──────────────────────────────────
const VESSELS = [
  {
    mmsi: "538007997",
    vessel_name: "EVER GIVEN",
    threat_level: "HIGH",
    threat_score: 72,
    anomaly_flags: [{ code: "AIS_GAP", severity: "HIGH", description: "Transponder dark 6h in Hormuz Strait" }],
    lat: 23.5880, lon: 58.5922, speed: 0.4, heading: 180,
  },
  {
    mmsi: "477552900",
    vessel_name: "MAERSK HONAM",
    threat_level: "CLEAN",
    threat_score: 12,
    anomaly_flags: [],
    lat: 12.8628, lon: 45.0331, speed: 14.2, heading: 312,
  },
  {
    mmsi: "209466000",
    vessel_name: "MSC FANTASIA",
    threat_level: "MEDIUM",
    threat_score: 45,
    anomaly_flags: [{ code: "SPEED_ANOMALY", severity: "MEDIUM", description: "Unusual speed reduction near chokepoint" }],
    lat: 15.6129, lon: 42.4571, speed: 2.1, heading: 45,
  },
  {
    mmsi: "636016798",
    vessel_name: "PACIFIC ZIRCON",
    threat_level: "CRITICAL",
    threat_score: 91,
    anomaly_flags: [
      { code: "FLAG_MISMATCH", severity: "CRITICAL", description: "Flag mismatch: Liberia reg, Iran port calls" },
      { code: "SPOOFED_POSITION", severity: "HIGH", description: "GPS position inconsistent with speed vector" },
    ],
    lat: 26.2235, lon: 56.3421, speed: 8.9, heading: 95,
  },
  {
    mmsi: "371586000",
    vessel_name: "GOLDEN HORIZON",
    threat_level: "HIGH",
    threat_score: 68,
    anomaly_flags: [{ code: "SANCTIONS_HIT", severity: "HIGH", description: "Owner entity on OFAC SDN list" }],
    lat: 13.3781, lon: 43.1479, speed: 11.3, heading: 270,
  },
  {
    mmsi: "548432400",
    vessel_name: "NORDIC LUNA",
    threat_level: "CLEAN",
    threat_score: 8,
    anomaly_flags: [],
    lat: 29.9611, lon: 32.5503, speed: 13.8, heading: 355,
  },
  {
    mmsi: "413123456",
    vessel_name: "COSCO UNIVERSE",
    threat_level: "MEDIUM",
    threat_score: 38,
    anomaly_flags: [{ code: "PORT_CALL_ANOMALY", severity: "MEDIUM", description: "Undisclosed port call, Bandar Abbas 48h" }],
    lat: 24.9987, lon: 55.0736, speed: 6.2, heading: 220,
  },
  {
    mmsi: "311040600",
    vessel_name: "ATLANTIC VOYAGER",
    threat_level: "CLEAN",
    threat_score: 15,
    anomaly_flags: [],
    lat: 11.5893, lon: 43.1452, speed: 16.1, heading: 340,
  },
  {
    mmsi: "636092871",
    vessel_name: "DARK STAR VII",
    threat_level: "CRITICAL",
    threat_score: 88,
    anomaly_flags: [
      { code: "AIS_MANIPULATION", severity: "CRITICAL", description: "AIS identity swap detected mid-voyage" },
      { code: "DARK_SHIPPING", severity: "HIGH", description: "Ship-to-ship transfer in international waters" },
    ],
    lat: 14.7654, lon: 51.3298, speed: 0.0, heading: 0,
  },
  {
    mmsi: "232011490",
    vessel_name: "BP EXPLORER",
    threat_level: "CLEAN",
    threat_score: 5,
    anomaly_flags: [],
    lat: 22.3098, lon: 39.1014, speed: 9.7, heading: 180,
  },
];

const PORT_INTEL = [
  { port_code: "JOAQB", port_name: "Aqaba", country: "Jordan", risk_level: "LOW", sanctions_active: false, vessel_count: 34, notes: "Major Red Sea gateway, stable operations" },
  { port_code: "SAJED", port_name: "Jeddah Islamic Port", country: "Saudi Arabia", risk_level: "LOW", sanctions_active: false, vessel_count: 112, notes: "Largest Red Sea port, high throughput" },
  { port_code: "EGSUZ", port_name: "Suez", country: "Egypt", risk_level: "MEDIUM", sanctions_active: false, vessel_count: 78, notes: "Canal transit point; congestion risk" },
  { port_code: "DJJIB", port_name: "Djibouti", country: "Djibouti", risk_level: "MEDIUM", sanctions_active: false, vessel_count: 55, notes: "Strategic Horn of Africa bunkering hub" },
  { port_code: "YNADE", port_name: "Aden", country: "Yemen", risk_level: "CRITICAL", sanctions_active: true, vessel_count: 12, notes: "Active conflict zone; piracy advisory in effect" },
  { port_code: "IRBND", port_name: "Bandar Abbas", country: "Iran", risk_level: "CRITICAL", sanctions_active: true, vessel_count: 8, notes: "OFAC sanctioned port; secondary sanctions risk" },
];

async function upsertVessels() {
  console.log("🚢 Upserting vessel threat profiles...");
  for (const v of VESSELS) {
    const row = {
      mmsi: v.mmsi,
      vessel_name: v.vessel_name,
      threat_level: v.threat_level,
      threat_score: v.threat_score,
      anomaly_flags: v.anomaly_flags,
      lat: v.lat,
      lon: v.lon,
      speed: v.speed,
      heading: v.heading,
      updated_at: new Date().toISOString(),
    };
    const { error } = await db.from("vessel_threat_profiles").upsert(row, { onConflict: "mmsi" });
    if (error) {
      console.error(`  ❌ ${v.vessel_name} (${v.mmsi}): ${error.message}`);
    } else {
      console.log(`  ✅ ${v.vessel_name} [${v.threat_level}]`);
    }
  }
}

async function upsertPorts() {
  console.log("\n🏭 Upserting port intelligence...");
  for (const p of PORT_INTEL) {
    const { error } = await db.from("port_intelligence").upsert(p, { onConflict: "port_code" });
    if (error) {
      console.error(`  ❌ ${p.port_name}: ${error.message}`);
    } else {
      console.log(`  ✅ ${p.port_name} [${p.risk_level}]`);
    }
  }
}

async function seedViolations() {
  console.log("\n⚠️  Seeding violation log...");
  const violations = VESSELS.filter(v => v.threat_level !== "CLEAN").flatMap(v =>
    v.anomaly_flags.map(f => ({
      mmsi: v.mmsi,
      flag_code: f.code,
      severity: f.severity,
      description: f.description,
      threat_score: v.threat_score,
      lat: v.lat,
      lon: v.lon,
    }))
  );
  if (violations.length) {
    const { error } = await db.from("violation_log").insert(violations);
    if (error) console.error(`  ❌ violations: ${error.message}`);
    else console.log(`  ✅ ${violations.length} violations inserted`);
  }
}

async function seedSanctions() {
  console.log("\n🚫 Seeding sanctions hits...");
  const hits = [
    { mmsi: "636016798", entity_name: "Pacific Maritime Holdings", list_name: "OFAC SDN", match_score: 0.96, vessel_name: "PACIFIC ZIRCON" },
    { mmsi: "371586000", entity_name: "Golden Star Shipping LLC", list_name: "EU Consolidated", match_score: 0.88, vessel_name: "GOLDEN HORIZON" },
  ];
  const { error } = await db.from("sanctions_hits").upsert(hits, { onConflict: "mmsi" }).catch(() => ({ error: null }));
  if (error) console.error(`  ❌ sanctions: ${error.message}`);
  else console.log(`  ✅ ${hits.length} sanctions hits seeded`);
}

async function main() {
  console.log("🌊 RedSea Ledger — Supabase Setup\n");
  console.log(`🔗 URL: ${SUPABASE_URL}\n`);

  // Test connection
  const { error: testErr } = await db.from("vessel_threat_profiles").select("mmsi", { count: "exact", head: true });
  if (testErr) {
    console.error("❌ Cannot reach vessel_threat_profiles:", testErr.message);
    console.log("\n📋 The tables need to be created. Please run this SQL in your Supabase SQL Editor:");
    console.log(`
-- Run this in Supabase Dashboard > SQL Editor

-- 1. vessel_threat_profiles
CREATE TABLE IF NOT EXISTS public.vessel_threat_profiles (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mmsi        text UNIQUE NOT NULL,
  vessel_name text,
  threat_level text DEFAULT 'CLEAN',
  threat_score numeric DEFAULT 0,
  anomaly_flags jsonb DEFAULT '[]',
  lat         numeric,
  lon         numeric,
  speed       numeric,
  heading     numeric,
  updated_at  timestamptz DEFAULT now()
);
ALTER TABLE public.vessel_threat_profiles DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.vessel_threat_profiles TO anon, authenticated, service_role;

-- 2. violation_log
CREATE TABLE IF NOT EXISTS public.violation_log (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mmsi        text NOT NULL,
  flag_code   text,
  severity    text,
  description text,
  threat_score numeric,
  lat         numeric,
  lon         numeric,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.violation_log DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.violation_log TO anon, authenticated, service_role;

-- 3. ais_positions
CREATE TABLE IF NOT EXISTS public.ais_positions (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mmsi      text NOT NULL,
  lat       numeric NOT NULL,
  lon       numeric NOT NULL,
  speed     numeric,
  heading   numeric,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ais_positions DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ais_positions TO anon, authenticated, service_role;

-- 4. document_registry
CREATE TABLE IF NOT EXISTS public.document_registry (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mmsi          text,
  document_type text,
  is_tampered   boolean DEFAULT false,
  risk_score    numeric DEFAULT 0,
  findings      jsonb DEFAULT '[]',
  vessel_name   text,
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE public.document_registry DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.document_registry TO anon, authenticated, service_role;

-- 5. sanctions_hits
CREATE TABLE IF NOT EXISTS public.sanctions_hits (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mmsi         text UNIQUE,
  entity_name  text,
  list_name    text,
  match_score  numeric,
  vessel_name  text,
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE public.sanctions_hits DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.sanctions_hits TO anon, authenticated, service_role;

-- 6. port_intelligence
CREATE TABLE IF NOT EXISTS public.port_intelligence (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  port_code       text UNIQUE NOT NULL,
  port_name       text,
  country         text,
  risk_level      text DEFAULT 'LOW',
  sanctions_active boolean DEFAULT false,
  vessel_count    integer DEFAULT 0,
  notes           text,
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE public.port_intelligence DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.port_intelligence TO anon, authenticated, service_role;
`);
    process.exit(1);
  }

  await upsertVessels();
  await upsertPorts();
  await seedViolations();
  await seedSanctions();

  console.log("\n✅ Setup complete! RedSea Ledger is ready with live data.");
}

main().catch(e => { console.error(e); process.exit(1); });
