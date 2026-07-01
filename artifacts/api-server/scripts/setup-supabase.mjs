#!/usr/bin/env node
/**
 * RedSea Ledger — Supabase seed (uses real column names discovered by introspection).
 *
 * vessel_threat_profiles: score, flags, last_lat, last_lon, last_speed, last_heading
 * sanctions_hits:         regime (NOT NULL), list_name, match_type, confidence, reference
 * violation_log:          flag_code, severity, description, threat_score, lat, lon
 * port_intelligence:      port_code, port_name, country, risk_level, sanctions_active, vessel_count, notes (jsonb array)
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const BASE_HEADERS = {
  "Content-Type":  "application/json",
  "apikey":        SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`,
  "Prefer":        "resolution=merge-duplicates,return=minimal",
};

async function upsert(table, rows) {
  const payload = Array.isArray(rows) ? rows : [rows];
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method:  "POST",
    headers: BASE_HEADERS,
    body:    JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: body };
  }
  return { ok: true };
}

async function count(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=0`, {
    headers: { ...BASE_HEADERS, "Prefer": "count=exact" },
  });
  return res.headers.get("content-range") ?? "?";
}

// ─── Vessel threat profiles (real column names) ───────────────────────────────
const VESSELS = [
  { mmsi:"538007997", vessel_name:"EVER GIVEN",       threat_level:"HIGH",     score:72, flags:[{code:"AIS_GAP",           severity:"HIGH",     description:"Transponder dark 6h in Hormuz Strait"}],                                                                                                          last_lat:23.5880, last_lon:58.5922, last_speed:0.4,  last_heading:180 },
  { mmsi:"477552900", vessel_name:"MAERSK HONAM",     threat_level:"CLEAN",    score:12, flags:[],                                                                                                                                                                                                              last_lat:12.8628, last_lon:45.0331, last_speed:14.2, last_heading:312 },
  { mmsi:"209466000", vessel_name:"MSC FANTASIA",     threat_level:"MEDIUM",   score:45, flags:[{code:"SPEED_ANOMALY",      severity:"MEDIUM",   description:"Unusual speed reduction near chokepoint"}],                                                                                                       last_lat:15.6129, last_lon:42.4571, last_speed:2.1,  last_heading:45  },
  { mmsi:"636016798", vessel_name:"PACIFIC ZIRCON",   threat_level:"CRITICAL", score:91, flags:[{code:"FLAG_MISMATCH",      severity:"CRITICAL", description:"Flag mismatch: Liberia reg, Iran port calls"},{code:"SPOOFED_POSITION",severity:"HIGH",description:"GPS position inconsistent with speed vector"}], last_lat:26.2235, last_lon:56.3421, last_speed:8.9,  last_heading:95  },
  { mmsi:"371586000", vessel_name:"GOLDEN HORIZON",   threat_level:"HIGH",     score:68, flags:[{code:"SANCTIONS_HIT",      severity:"HIGH",     description:"Owner entity on OFAC SDN list"}],                                                                                                                last_lat:13.3781, last_lon:43.1479, last_speed:11.3, last_heading:270 },
  { mmsi:"548432400", vessel_name:"NORDIC LUNA",      threat_level:"CLEAN",    score:8,  flags:[],                                                                                                                                                                                                              last_lat:29.9611, last_lon:32.5503, last_speed:13.8, last_heading:355 },
  { mmsi:"413123456", vessel_name:"COSCO UNIVERSE",   threat_level:"MEDIUM",   score:38, flags:[{code:"PORT_CALL_ANOMALY",  severity:"MEDIUM",   description:"Undisclosed port call, Bandar Abbas 48h"}],                                                                                                      last_lat:24.9987, last_lon:55.0736, last_speed:6.2,  last_heading:220 },
  { mmsi:"311040600", vessel_name:"ATLANTIC VOYAGER", threat_level:"CLEAN",    score:15, flags:[],                                                                                                                                                                                                              last_lat:11.5893, last_lon:43.1452, last_speed:16.1, last_heading:340 },
  { mmsi:"636092871", vessel_name:"DARK STAR VII",    threat_level:"CRITICAL", score:88, flags:[{code:"AIS_MANIPULATION",   severity:"CRITICAL", description:"AIS identity swap detected mid-voyage"},{code:"DARK_SHIPPING",severity:"HIGH",description:"Ship-to-ship transfer in international waters"}],      last_lat:14.7654, last_lon:51.3298, last_speed:0.0,  last_heading:0   },
  { mmsi:"232011490", vessel_name:"BP EXPLORER",      threat_level:"CLEAN",    score:5,  flags:[],                                                                                                                                                                                                              last_lat:22.3098, last_lon:39.1014, last_speed:9.7,  last_heading:180 },
];

// ─── Sanctions hits (real: regime NOT NULL, list_name, match_type, confidence) ─
const SANCTIONS = [
  { mmsi:"636016798", vessel_name:"PACIFIC ZIRCON", regime:"OFAC",           list_name:"SDN",              match_type:"owner",  confidence:0.96, reference:"SDN-2023-7821" },
  { mmsi:"371586000", vessel_name:"GOLDEN HORIZON", regime:"EU",             list_name:"EU Consolidated",  match_type:"owner",  confidence:0.88, reference:"EU-2023-4456"  },
];

// ─── Violations (flag_code, severity, description, threat_score) ──────────────
const VIOLATIONS = VESSELS.filter(v => v.threat_level !== "CLEAN").flatMap(v =>
  v.flags.map(f => ({
    mmsi:         v.mmsi,
    flag_code:    f.code,
    severity:     f.severity,
    description:  f.description,
    threat_score: v.score,
    lat:          v.last_lat,
    lon:          v.last_lon,
  }))
);

async function main() {
  console.log("🌊 RedSea Ledger — Supabase Seed\n");

  // ── Vessels ──
  console.log("🚢 Seeding vessel threat profiles...");
  for (const v of VESSELS) {
    const r = await upsert("vessel_threat_profiles", {
      mmsi:         v.mmsi,
      vessel_name:  v.vessel_name,
      threat_level: v.threat_level,
      score:        v.score,
      flags:        v.flags,
      last_lat:     v.last_lat,
      last_lon:     v.last_lon,
      last_speed:   v.last_speed,
      last_heading: v.last_heading,
      updated_at:   new Date().toISOString(),
    });
    if (r.ok) console.log(`  ✅ ${v.vessel_name} [${v.threat_level}] score=${v.score}`);
    else      console.error(`  ❌ ${v.vessel_name}: ${r.error}`);
  }

  // ── Sanctions ──
  console.log("\n🚫 Seeding sanctions hits...");
  for (const s of SANCTIONS) {
    const r = await upsert("sanctions_hits", s);
    if (r.ok) console.log(`  ✅ ${s.vessel_name} — ${s.regime}/${s.list_name}`);
    else      console.error(`  ❌ ${s.vessel_name}: ${r.error}`);
  }

  // ── Violations (clear old test rows, add fresh ones) ──
  console.log("\n⚠️  Seeding violation log...");
  const vr = await upsert("violation_log", VIOLATIONS);
  if (vr.ok) console.log(`  ✅ ${VIOLATIONS.length} violations`);
  else       console.error(`  ❌ violations: ${vr.error}`);

  // ── Counts ──
  console.log("\n📊 Row counts:");
  for (const t of ["vessel_threat_profiles","port_intelligence","violation_log","sanctions_hits"]) {
    console.log(`  ${t}: ${await count(t)}`);
  }

  console.log("\n✅ Seed complete!");
}

main().catch(e => { console.error(e); process.exit(1); });
