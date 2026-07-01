#!/usr/bin/env node
/**
 * Direct Postgres seed — bypasses PostgREST schema cache.
 */
import pg from "pg";
const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log("🌊 RedSea Ledger — Direct DB Seed\n");

// ── Reload PostgREST schema cache ──────────────────────────────────────────
await client.query("SELECT pg_notify('pgrst', 'reload schema')");
console.log("🔄 PostgREST schema cache reloaded\n");

// ── Ensure all columns exist ──────────────────────────────────────────────
await client.query(`
  ALTER TABLE public.vessel_threat_profiles
    ADD COLUMN IF NOT EXISTS threat_score  numeric   DEFAULT 0,
    ADD COLUMN IF NOT EXISTS threat_level  text      NOT NULL DEFAULT 'CLEAN',
    ADD COLUMN IF NOT EXISTS vessel_name   text,
    ADD COLUMN IF NOT EXISTS anomaly_flags jsonb     DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS lat           numeric,
    ADD COLUMN IF NOT EXISTS lon           numeric,
    ADD COLUMN IF NOT EXISTS speed         numeric,
    ADD COLUMN IF NOT EXISTS heading       numeric,
    ADD COLUMN IF NOT EXISTS updated_at    timestamptz DEFAULT now();
`);

await client.query(`
  ALTER TABLE public.sanctions_hits
    ADD COLUMN IF NOT EXISTS entity_name  text,
    ADD COLUMN IF NOT EXISTS list_name    text,
    ADD COLUMN IF NOT EXISTS match_score  numeric,
    ADD COLUMN IF NOT EXISTS vessel_name  text;
`);

await client.query(`
  ALTER TABLE public.violation_log
    ADD COLUMN IF NOT EXISTS flag_code    text,
    ADD COLUMN IF NOT EXISTS severity     text,
    ADD COLUMN IF NOT EXISTS description  text,
    ADD COLUMN IF NOT EXISTS threat_score numeric,
    ADD COLUMN IF NOT EXISTS lat          numeric,
    ADD COLUMN IF NOT EXISTS lon          numeric;
`);

console.log("✅ Schema columns verified\n");

// ── Vessel threat profiles ─────────────────────────────────────────────────
const vessels = [
  { mmsi:"538007997", vessel_name:"EVER GIVEN",       threat_level:"HIGH",     threat_score:72, anomaly_flags:[{code:"AIS_GAP",severity:"HIGH",description:"Transponder dark 6h in Hormuz Strait"}],                                                                                              lat:23.5880, lon:58.5922, speed:0.4,  heading:180 },
  { mmsi:"477552900", vessel_name:"MAERSK HONAM",     threat_level:"CLEAN",    threat_score:12, anomaly_flags:[],                                                                                                                                                                                  lat:12.8628, lon:45.0331, speed:14.2, heading:312 },
  { mmsi:"209466000", vessel_name:"MSC FANTASIA",     threat_level:"MEDIUM",   threat_score:45, anomaly_flags:[{code:"SPEED_ANOMALY",severity:"MEDIUM",description:"Unusual speed reduction near chokepoint"}],                                                                                    lat:15.6129, lon:42.4571, speed:2.1,  heading:45  },
  { mmsi:"636016798", vessel_name:"PACIFIC ZIRCON",   threat_level:"CRITICAL", threat_score:91, anomaly_flags:[{code:"FLAG_MISMATCH",severity:"CRITICAL",description:"Flag mismatch: Liberia reg, Iran port calls"},{code:"SPOOFED_POSITION",severity:"HIGH",description:"GPS inconsistent with speed vector"}], lat:26.2235, lon:56.3421, speed:8.9,  heading:95  },
  { mmsi:"371586000", vessel_name:"GOLDEN HORIZON",   threat_level:"HIGH",     threat_score:68, anomaly_flags:[{code:"SANCTIONS_HIT",severity:"HIGH",description:"Owner entity on OFAC SDN list"}],                                                                                               lat:13.3781, lon:43.1479, speed:11.3, heading:270 },
  { mmsi:"548432400", vessel_name:"NORDIC LUNA",      threat_level:"CLEAN",    threat_score:8,  anomaly_flags:[],                                                                                                                                                                                  lat:29.9611, lon:32.5503, speed:13.8, heading:355 },
  { mmsi:"413123456", vessel_name:"COSCO UNIVERSE",   threat_level:"MEDIUM",   threat_score:38, anomaly_flags:[{code:"PORT_CALL_ANOMALY",severity:"MEDIUM",description:"Undisclosed port call, Bandar Abbas 48h"}],                                                                               lat:24.9987, lon:55.0736, speed:6.2,  heading:220 },
  { mmsi:"311040600", vessel_name:"ATLANTIC VOYAGER", threat_level:"CLEAN",    threat_score:15, anomaly_flags:[],                                                                                                                                                                                  lat:11.5893, lon:43.1452, speed:16.1, heading:340 },
  { mmsi:"636092871", vessel_name:"DARK STAR VII",    threat_level:"CRITICAL", threat_score:88, anomaly_flags:[{code:"AIS_MANIPULATION",severity:"CRITICAL",description:"AIS identity swap detected mid-voyage"},{code:"DARK_SHIPPING",severity:"HIGH",description:"Ship-to-ship transfer in international waters"}], lat:14.7654, lon:51.3298, speed:0.0,  heading:0   },
  { mmsi:"232011490", vessel_name:"BP EXPLORER",      threat_level:"CLEAN",    threat_score:5,  anomaly_flags:[],                                                                                                                                                                                  lat:22.3098, lon:39.1014, speed:9.7,  heading:180 },
];

console.log("🚢 Seeding vessels...");
for (const v of vessels) {
  await client.query(`
    INSERT INTO public.vessel_threat_profiles
      (mmsi, vessel_name, threat_level, threat_score, anomaly_flags, lat, lon, speed, heading, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
    ON CONFLICT (mmsi) DO UPDATE SET
      vessel_name=EXCLUDED.vessel_name, threat_level=EXCLUDED.threat_level,
      threat_score=EXCLUDED.threat_score, anomaly_flags=EXCLUDED.anomaly_flags,
      lat=EXCLUDED.lat, lon=EXCLUDED.lon, speed=EXCLUDED.speed,
      heading=EXCLUDED.heading, updated_at=now()
  `, [v.mmsi, v.vessel_name, v.threat_level, v.threat_score, JSON.stringify(v.anomaly_flags), v.lat, v.lon, v.speed, v.heading]);
  console.log(`  ✅ ${v.vessel_name} [${v.threat_level}]`);
}

// ── Sanctions hits ─────────────────────────────────────────────────────────
console.log("\n🚫 Seeding sanctions hits...");
const sanctions = [
  { mmsi:"636016798", entity_name:"Pacific Maritime Holdings", list_name:"OFAC SDN",         match_score:0.96, vessel_name:"PACIFIC ZIRCON" },
  { mmsi:"371586000", entity_name:"Golden Star Shipping LLC",  list_name:"EU Consolidated",  match_score:0.88, vessel_name:"GOLDEN HORIZON" },
];
for (const s of sanctions) {
  await client.query(`
    INSERT INTO public.sanctions_hits (mmsi, entity_name, list_name, match_score, vessel_name)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (mmsi) DO UPDATE SET
      entity_name=EXCLUDED.entity_name, list_name=EXCLUDED.list_name,
      match_score=EXCLUDED.match_score, vessel_name=EXCLUDED.vessel_name
  `, [s.mmsi, s.entity_name, s.list_name, s.match_score, s.vessel_name]);
  console.log(`  ✅ ${s.vessel_name} — ${s.list_name}`);
}

// ── Verification ───────────────────────────────────────────────────────────
console.log("\n📊 Final counts:");
for (const t of ["vessel_threat_profiles","port_intelligence","violation_log","sanctions_hits","ais_positions","document_registry"]) {
  const r = await client.query(`SELECT COUNT(*) FROM public.${t}`);
  console.log(`  ${t}: ${r.rows[0].count} rows`);
}

// ── Reload schema cache again now that columns are confirmed ──────────────
await client.query("SELECT pg_notify('pgrst', 'reload schema')");

await client.end();
console.log("\n✅ All done — PostgREST schema cache reloaded.");
